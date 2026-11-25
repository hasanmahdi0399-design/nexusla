import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath, refreshCounts } from '../lib/router.js'
import { loadFriends } from '../lib/social.js'
import { clean, clock, dayLabel, errText, nameOf, sameDay, timeAgo, uploadImage } from '../lib/util.js'
import { Avatar, Button, Empty, FilePick, Modal, Skeleton, useLightbox } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { ReportButton } from '../components/Post.jsx'

const MIN = 'id,username,display_name,avatar_url'

/* Messenger-style private DMs: conversation list + chat. One-to-one only, no groups. */
export default function Messages({ param }) {
  const { user } = useAuth(); const { t, lang } = useT()
  const [convos, setConvos] = useState(null); const [peer, setPeer] = useState(null); const [missing, setMissing] = useState(false)
  const [filter, setFilter] = useState(''); const [newOpen, setNewOpen] = useState(false)

  const loadConvos = useCallback(async () => {
    const { data } = await supabase.from('messages').select('id,sender_id,receiver_id,body,image_url,read_at,created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(400)
    const map = new Map()
    for (const m of data || []) {
      const id = m.sender_id === user.id ? m.receiver_id : m.sender_id
      let c = map.get(id)
      if (!c) { c = { id, last: m, unread: 0 }; map.set(id, c) }
      if (m.receiver_id === user.id && !m.read_at) c.unread++
    }
    const ids = [...map.keys()]
    const profs = ids.length ? (await supabase.from('profiles').select(MIN).in('id', ids)).data || [] : []
    const byId = Object.fromEntries(profs.map((p) => [p.id, p]))
    setConvos([...map.values()].map((c) => ({ ...c, profile: byId[c.id] })).filter((c) => c.profile))
  }, [user.id])
  useEffect(() => { loadConvos() }, [loadConvos])

  // open chat from the URL (#/messages/<username>)
  useEffect(() => {
    let alive = true
    setMissing(false)
    if (!param) { setPeer(null); return }
    supabase.from('profiles').select(MIN).eq('username', param.toLowerCase()).maybeSingle().then(({ data }) => {
      if (!alive) return
      if (!data || data.id === user.id) { setPeer(null); setMissing(true) } else setPeer(data)
    })
    return () => { alive = false }
  }, [param, user.id])

  // new message arriving for somebody else → refresh the list
  useEffect(() => {
    const ch = supabase.channel('convos-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, loadConvos)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user.id, loadConvos])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (convos || []).filter((c) => !q || c.profile.username.includes(q) || (c.profile.display_name || '').toLowerCase().includes(q))
  }, [convos, filter])

  return (
    <div className="msg-shell">
      {/* list */}
      <section className={`card msg-list ${param ? 'hidden md:flex' : 'flex'}`}>
        <div className="space-y-3 border-b border-white/10 p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">{t('messages')}</h2>
            <button className="round-btn" onClick={() => setNewOpen(true)} aria-label={t('new_message')}><Icon name="edit" size={18} /></button>
          </div>
          <div className="relative"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !rounded-full !py-2 !pl-9" placeholder={t('search_chats')} value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {convos === null && <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
          {shown.map((c, i) => (
            <button key={c.id} className={`convo rise ${peer?.id === c.id ? 'on' : ''}`} style={{ '--i': Math.min(i, 8) }} onClick={() => go(chatPath(c.profile.username))}>
              <Avatar p={c.profile} size={48} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2"><b className={`truncate ${c.unread ? '' : 'font-semibold'}`}>{nameOf(c.profile)}</b><span className="flex-none text-xs text-muted">{timeAgo(c.last.created_at, lang)}</span></span>
                <span className={`block truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>
                  {c.last.sender_id === user.id && `${t('you')}: `}{c.last.image_url && !c.last.body ? `📷 ${t('photo')}` : c.last.body}
                </span>
              </span>
              {c.unread > 0 && <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-[#1a1205]">{c.unread}</span>}
            </button>
          ))}
          {convos && !shown.length && <Empty icon="chat">{filter ? t('nothing_found') : t('no_chats')}</Empty>}
        </div>
      </section>

      {/* chat */}
      <section className={`card msg-chat ${param ? 'flex' : 'hidden md:flex'}`}>
        {peer ? <Chat key={peer.id} peer={peer} onActivity={loadConvos} />
          : <div className="grid flex-1 place-items-center p-6"><Empty icon="chat">{missing ? t('user_not_found') : t('select_chat')}</Empty></div>}
      </section>

      {newOpen && <NewChat onClose={() => setNewOpen(false)} />}
    </div>
  )
}

function Chat({ peer, onActivity }) {
  const { user } = useAuth(); const { t, lang } = useT(); const toast = useToast(); const zoom = useLightbox()
  const [msgs, setMsgs] = useState(null); const [text, setText] = useState(''); const [file, setFile] = useState(null); const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false); const [blocked, setBlocked] = useState(false); const [menu, setMenu] = useState(false)
  const list = useRef(null)

  const markRead = useCallback(async () => {
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('receiver_id', user.id).eq('sender_id', peer.id).is('read_at', null)
    refreshCounts(); onActivity?.()
  }, [peer.id, user.id])

  const load = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peer.id}),and(sender_id.eq.${peer.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false }).limit(120)
    setMsgs((data || []).reverse()); markRead()
  }, [peer.id, user.id])

  useEffect(() => {
    load()
    supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', peer.id).maybeSingle().then((r) => setBlocked(!!r.data))
    const ch = supabase.channel(`chat-${user.id}-${peer.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, (e) => {
        if (e.new.sender_id !== peer.id) return
        setMsgs((l) => (l && !l.some((m) => m.id === e.new.id) ? [...l, e.new] : l)); markRead()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, (e) => {
        setMsgs((l) => l && l.map((m) => (m.id === e.new.id ? { ...m, read_at: e.new.read_at } : m)))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [msgs?.length])
  useEffect(() => { if (!file) return setPreview(null); const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u) }, [file])

  const send = async () => {
    if ((!text.trim() && !file) || busy) return
    setBusy(true)
    try {
      const image_url = file ? await uploadImage(user.id, file, 1280) : null
      const { data, error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: peer.id, body: text.trim(), image_url }).select().single()
      if (error) throw error
      setMsgs((l) => [...(l || []), data]); setText(''); setFile(null); onActivity?.()
    } catch (e) { toast(/row-level/i.test(e.message || '') ? t('cant_message') : errText(e, t), 'error') }
    setBusy(false)
  }
  const toggleBlock = async () => {
    setMenu(false)
    const { error } = blocked
      ? await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', peer.id)
      : await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: peer.id })
    if (error) toast(errText(error, t), 'error'); else { setBlocked(!blocked); toast(blocked ? t('unblocked') : t('blocked_done'), 'ok') }
  }

  const lastMine = msgs ? [...msgs].reverse().find((m) => m.sender_id === user.id) : null

  return (
    <>
      <header className="flex items-center gap-3 border-b border-white/10 p-3">
        <button className="round-btn md:hidden" onClick={() => go('messages')} aria-label={t('back')}><Icon name="back" size={18} /></button>
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go(profilePath(peer.username))}>
          <Avatar p={peer} size={42} /><span className="min-w-0"><b className="block truncate">{nameOf(peer)}</b><span className="block truncate text-xs text-muted">@{peer.username}</span></span>
        </button>
        <div className="relative">
          <button className="round-btn" onClick={() => setMenu(!menu)} aria-label="More"><Icon name="more" size={18} /></button>
          {menu && (
            <div className="menu !w-48">
              <button onClick={() => go(profilePath(peer.username))}><Icon name="user" size={16} />{t('view_profile')}</button>
              <button onClick={toggleBlock}><Icon name="block" size={16} />{blocked ? t('unblock') : t('block')}</button>
              <ReportButton type="conversation" id={peer.id} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm hover:bg-accent/15 hover:text-accent" />
            </div>
          )}
        </div>
      </header>

      <div ref={list} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-panel2 px-3 py-1 text-xs text-muted"><Icon name="lock" size={12} />{t('dm_private')}</p>
        {msgs === null && <Skeleton className="h-10 w-1/2" />}
        {msgs?.map((m, i) => {
          const mine = m.sender_id === user.id; const prev = msgs[i - 1]
          return (
            <div key={m.id}>
              {(!prev || !sameDay(prev.created_at, m.created_at)) && <p className="my-3 text-center text-xs text-muted">{dayLabel(m.created_at, lang)}</p>}
              <div className={`bubble ${mine ? 'me' : 'them'}`} title={clock(m.created_at, lang)}>
                {m.image_url && <img src={m.image_url} alt="" loading="lazy" onClick={() => zoom(m.image_url)} />}
                {m.body && <span className={m.image_url ? 'mt-1 block' : ''}>{m.body}</span>}
              </div>
              {(!msgs[i + 1] || msgs[i + 1].sender_id !== m.sender_id || new Date(msgs[i + 1].created_at) - new Date(m.created_at) > 300000) && (
                <p className={`mt-0.5 px-1 text-[11px] text-muted ${mine ? 'text-right' : ''}`}>{clock(m.created_at, lang)}{mine && lastMine?.id === m.id && m.read_at ? ` · ${t('seen')}` : ''}</p>
              )}
            </div>
          )
        })}
        {msgs && !msgs.length && <Empty icon="chat">{t('say_hi', { name: nameOf(peer) })}</Empty>}
      </div>

      {blocked ? (
        <div className="border-t border-white/10 p-3 text-center text-sm text-muted">{t('you_blocked')} <button className="link" onClick={toggleBlock}>{t('unblock')}</button></div>
      ) : (
        <div className="space-y-2 border-t border-white/10 p-3 pb-3">
          {preview && <div className="relative w-fit fade"><img src={preview} alt="" className="h-20 rounded-lg object-cover" /><button className="round-btn absolute -right-2 -top-2 !h-6 !w-6 !bg-black/80" onClick={() => setFile(null)}><Icon name="x" size={12} /></button></div>}
          <div className="flex items-end gap-2">
            <FilePick onPick={setFile}><span className="round-btn" aria-label={t('photo')}><Icon name="image" size={18} /></span></FilePick>
            <textarea className="input !rounded-2xl !py-2.5" rows={1} style={{ minHeight: 42, maxHeight: 120 }} maxLength={5000} value={text} placeholder={t('type_message')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send() } }} />
            <button className="round-btn !bg-accent !text-[#1a1205] disabled:opacity-50" disabled={busy || (!text.trim() && !file)} onClick={send} aria-label={t('send')}>{busy ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon name="send" size={18} />}</button>
          </div>
        </div>
      )}
    </>
  )
}

function NewChat({ onClose }) {
  const { user } = useAuth(); const { t } = useT()
  const [q, setQ] = useState(''); const [friends, setFriends] = useState(null); const [found, setFound] = useState([])
  useEffect(() => { loadFriends(user.id, 30).then((r) => setFriends(r.map((x) => x.profile))) }, [user.id])
  useEffect(() => {
    const term = clean(q.trim())
    if (!term) { setFound([]); return }
    const id = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select(MIN).ilike('username', `%${term}%`).neq('id', user.id).limit(8)
      setFound(data || [])
    }, 250)
    return () => clearTimeout(id)
  }, [q, user.id])
  const list = q.trim() ? found : friends
  const open = (p) => { onClose(); go(chatPath(p.username)) }
  return (
    <Modal title={t('new_message')} onClose={onClose}>
      <input className="input mb-3" autoFocus placeholder={t('search_survivors')} value={q} onChange={(e) => setQ(e.target.value)} />
      {!q.trim() && <p className="mb-2 text-xs uppercase tracking-wider text-muted">{t('friends')}</p>}
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {list?.map((p) => <button key={p.id} className="sidelink" onClick={() => open(p)}><Avatar p={p} size={38} /><span className="min-w-0 text-left"><b className="block truncate">{nameOf(p)}</b><span className="text-xs text-muted">@{p.username}</span></span></button>)}
        {list && !list.length && <p className="py-4 text-center text-sm text-muted">{q.trim() ? t('nothing_found') : t('no_friends_yet')}</p>}
      </div>
    </Modal>
  )
}
