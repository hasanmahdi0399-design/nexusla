import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath } from '../lib/router.js'
import { fetchRelations, friendAction, loadFriends, toggleFollow } from '../lib/social.js'
import { cleanUsername, errText, nameOf, uploadImage } from '../lib/util.js'
import { Avatar, Button, Card, Empty, FilePick, Modal, Skeleton, useLightbox } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { PostFeed, ReportButton } from '../components/Post.jsx'

export default function Profile({ username }) {
  const { user, me, refreshMe } = useAuth(); const { t, lang } = useT(); const toast = useToast(); const zoom = useLightbox()
  const [p, setP] = useState(undefined) // undefined = loading, null = not found / private
  const [stats, setStats] = useState({ friends: 0, followers: 0, following: 0 })
  const [friends, setFriends] = useState(null)
  const [rel, setRel] = useState(null)
  const [tab, setTab] = useState('posts'); const [edit, setEdit] = useState(false); const [busy, setBusy] = useState(''); const [menu, setMenu] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const mine = p && p.id === user.id

  const load = useCallback(async () => {
    const uname = cleanUsername(username)
    const { data } = await supabase.from('profiles').select('*').eq('username', uname).maybeSingle()
    setP(data || null)
    if (!data) return
    const [fl, fo, fg] = await Promise.all([
      loadFriends(data.id, 60),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', data.id),
      supabase.from('follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', data.id),
    ])
    setFriends(fl.map((x) => x.profile))
    setStats({ friends: fl.length, followers: fo.count || 0, following: fg.count || 0 })
    if (data.id !== user.id) {
      const r = await fetchRelations(user.id, [data.id]); setRel(r[data.id])
      const b = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', data.id).maybeSingle()
      setBlocked(!!b.data)
    }
  }, [username, user.id])
  useEffect(() => { load() }, [load])

  const changeImage = async (key, file, maxDim) => {
    setBusy(key)
    try {
      const url = await uploadImage(user.id, file, maxDim)
      const { error } = await supabase.from('profiles').update({ [key]: url }).eq('id', user.id)
      if (error) throw error
      setP((x) => ({ ...x, [key]: url })); refreshMe(); toast(t('saved'), 'ok')
    } catch (e) { toast(errText(e, t), 'error') }
    setBusy('')
  }

  const doFriend = async () => {
    setBusy('friend')
    const { error } = await friendAction(user.id, p.id, rel)
    if (error) toast(errText(error, t), 'error')
    const r = await fetchRelations(user.id, [p.id]); setRel(r[p.id]); loadFriendsOnly(); setBusy('')
  }
  const loadFriendsOnly = async () => { const fl = await loadFriends(p.id, 60); setFriends(fl.map((x) => x.profile)); setStats((s) => ({ ...s, friends: fl.length })) }
  const doFollow = async () => {
    setBusy('follow')
    const { error } = await toggleFollow(user.id, p.id, rel)
    if (error) toast(errText(error, t), 'error')
    else { setRel((r) => ({ ...r, following: !r.following })); setStats((s) => ({ ...s, followers: s.followers + (rel.following ? -1 : 1) })) }
    setBusy('')
  }
  const doBlock = async () => {
    setMenu(false)
    const { error } = blocked
      ? await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', p.id)
      : await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: p.id })
    if (error) toast(errText(error, t), 'error'); else { setBlocked(!blocked); toast(blocked ? t('unblocked') : t('blocked_done'), 'ok') }
  }

  if (p === undefined) return <div className="mx-auto max-w-4xl space-y-3"><Skeleton className="h-56 w-full" /><Skeleton className="h-24 w-full" /></div>
  if (p === null) return <Card className="mx-auto max-w-md"><Empty icon="lock">{t('profile_unavailable')}</Empty></Card>

  const friendLabel = rel?.friend ? t('friends_status') : rel?.request === 'sent' ? t('cancel_request') : rel?.request === 'received' ? t('accept') : t('add_friend')
  const friendIcon = rel?.friend ? 'userCheck' : 'userPlus'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card flat hud className="!overflow-visible">
        {/* banner */}
        <div className="cover rounded-t-[14px]">
          {p.banner_url && <img src={p.banner_url} alt="" className={mine ? '' : 'zoomable'} onClick={() => zoom(p.banner_url)} />}
          {busy === 'banner_url' && <div className="upload-veil"><span className="spinner" /></div>}
          {mine && (
            <FilePick className="absolute bottom-3 right-3 z-[4]" onPick={(f) => changeImage('banner_url', f, 1800)}>
              <span className="btn btn-sm !bg-black/60 text-white backdrop-blur"><Icon name="camera" size={16} />{p.banner_url ? t('change_banner') : t('add_banner')}</span>
            </FilePick>
          )}
        </div>

        {/* header */}
        <div className="px-4 pb-0 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="relative -mt-14 w-fit md:-mt-16">
              <button onClick={() => p.avatar_url && zoom(p.avatar_url)} className="rounded-full">
                <Avatar p={p} size={128} ring className="!text-5xl" />
              </button>
              {busy === 'avatar_url' && <div className="upload-veil !rounded-full"><span className="spinner" /></div>}
              {mine && (
                <FilePick className="absolute bottom-1 right-1 z-[4]" onPick={(f) => changeImage('avatar_url', f, 700)}>
                  <span className="round-btn !h-9 !w-9 !bg-accent !text-[#1a1205] shadow-lg" aria-label={t('change_photo')}><Icon name="camera" size={16} /></span>
                </FilePick>
              )}
            </div>
            <div className="min-w-0 flex-1 md:pb-3">
              <h1 className="font-display text-3xl font-bold leading-tight">{nameOf(p)}</h1>
              <p className="text-sm text-muted">@{p.username}
                {p.role !== 'user' && <span className="tag amber ml-2"><Icon name="shield" size={12} />{p.role}</span>}
              </p>
              <p className="mt-1 text-sm text-muted"><b className="text-ink">{stats.friends}</b> {t('friends').toLowerCase()} · <b className="text-ink">{stats.followers}</b> {t('followers')} · <b className="text-ink">{stats.following}</b> {t('following')}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:pb-3">
              {mine ? (
                <Button icon="edit" onClick={() => setEdit(true)}>{t('edit_profile')}</Button>
              ) : rel && (
                <>
                  <Button icon={friendIcon} variant={rel.friend ? 'soft' : 'primary'} busy={busy === 'friend'} onClick={doFriend}>{friendLabel}</Button>
                  <Button icon="chat" variant="soft" onClick={() => go(chatPath(p.username))}>{t('message')}</Button>
                  <Button variant="ghost" busy={busy === 'follow'} onClick={doFollow}>{rel.following ? t('unfollow') : t('follow')}</Button>
                  <div className="relative">
                    <button className="round-btn" onClick={() => setMenu(!menu)} aria-label="More"><Icon name="more" size={18} /></button>
                    {menu && (
                      <div className="menu !w-48">
                        <button onClick={doBlock}><Icon name="block" size={16} />{blocked ? t('unblock') : t('block')}</button>
                        <ReportButton type="user" id={p.id} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm hover:bg-accent/15 hover:text-accent" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {p.bio && <p className="mt-3 whitespace-pre-wrap text-[15px]">{p.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.game_nick && <span className="tag"><Icon name="gamepad" size={13} />{p.game_nick}</span>}
            {p.server && <span className="tag green"><Icon name="globe" size={13} />{p.server}</span>}
            {p.camp_name && <span className="tag amber"><Icon name="tent" size={13} />{p.camp_name}</span>}
            <span className="tag"><Icon name="calendar" size={13} />{t('joined', { date: new Date(p.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang, { year: 'numeric', month: 'short' }) })}</span>
          </div>
          <div className="mt-3 flex border-t border-white/10">
            {['posts', 'about', 'friends'].map((k) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t('tab_' + k)}</button>)}
          </div>
        </div>
      </Card>

      {tab === 'posts' && (
        <div className="mx-auto max-w-[640px]"><PostFeed authorId={p.id} composer={mine} empty={mine ? t('empty_mine') : t('empty_theirs')} /></div>
      )}

      {tab === 'about' && (
        <Card hud i={0} className="space-y-3">
          <h3 className="font-display text-xl font-bold">{t('tab_about')}</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ['gamepad', t('game_nick'), p.game_nick], ['globe', t('server'), p.server], ['tent', t('camp'), p.camp_name],
              ['calendar', t('joined_label'), new Date(p.created_at).toLocaleDateString()],
              ['lock', t('profile_visibility'), p.profile_visibility === 'public' ? t('public') : t('private')],
            ].map(([ic, k, v]) => (
              <div key={k} className="flex items-center gap-3 rounded-xl bg-panel2 p-3"><Icon name={ic} size={20} className="text-accent" /><div><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd className="font-semibold">{v || '—'}</dd></div></div>
            ))}
            <button className="flex items-center gap-3 rounded-xl bg-panel2 p-3 text-left transition hover:bg-accent/10" onClick={() => { navigator.clipboard?.writeText(p.user_code); toast(t('copied'), 'ok') }}>
              <Icon name="copy" size={20} className="text-accent" /><div><dt className="text-xs uppercase tracking-wider text-muted">{t('user_code')}</dt><dd className="font-semibold">{p.user_code}</dd></div>
            </button>
          </dl>
        </Card>
      )}

      {tab === 'friends' && (
        <Card hud i={0} className="space-y-3">
          <h3 className="font-display text-xl font-bold">{t('friends')} · {stats.friends}</h3>
          {friends && !friends.length && <Empty icon="users">{t('no_friends_yet')}</Empty>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {friends?.map((f, i) => (
              <button key={f.id} className="lift rise flex items-center gap-3 rounded-xl border border-white/10 bg-panel2 p-3 text-left" style={{ '--i': Math.min(i, 8) }} onClick={() => go(profilePath(f.username))}>
                <Avatar p={f} size={48} /><span className="min-w-0"><b className="block truncate">{nameOf(f)}</b><span className="block truncate text-xs text-muted">@{f.username}</span></span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {edit && <EditModal p={p} onClose={() => setEdit(false)} onSaved={(np) => { setP(np); refreshMe(); setEdit(false); toast(t('saved'), 'ok') }} />}
    </div>
  )
}

function EditModal({ p, onClose, onSaved }) {
  const { user } = useAuth(); const { t } = useT(); const toast = useToast()
  const [f, setF] = useState({ display_name: p.display_name || '', bio: p.bio || '', game_nick: p.game_nick || '', server: p.server || '', camp_name: p.camp_name || '', profile_visibility: p.profile_visibility })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setBusy(true)
    const patch = { ...f, display_name: f.display_name.trim() || p.username, bio: f.bio.trim() }
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    setBusy(false)
    if (error) return toast(errText(error, t), 'error')
    onSaved({ ...p, ...patch })
  }
  const field = (k, label, props = {}) => (
    <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span><input className="input" value={f[k]} onChange={set(k)} {...props} /></label>
  )
  return (
    <Modal title={t('edit_profile')} onClose={onClose}>
      <div className="space-y-3">
        {field('display_name', t('display_name'), { maxLength: 40 })}
        <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('bio')}</span><textarea className="input" rows={3} maxLength={500} value={f.bio} onChange={set('bio')} /></label>
        {field('game_nick', t('game_nick'), { maxLength: 40 })}
        {field('server', t('server'), { maxLength: 40 })}
        {field('camp_name', t('camp'), { maxLength: 40 })}
        <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('profile_visibility')}</span>
          <select className="input" value={f.profile_visibility} onChange={set('profile_visibility')}><option value="public">{t('public')}</option><option value="private">{t('private')}</option></select></label>
        <p className="text-xs text-muted">{t('photo_hint')}</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button busy={busy} onClick={save}>{t('save')}</Button></div>
      </div>
    </Modal>
  )
}
