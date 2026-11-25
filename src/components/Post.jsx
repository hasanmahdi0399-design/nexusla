import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { errText, nameOf, timeAgo, uploadImage } from '../lib/util.js'
import { go, profilePath } from '../lib/router.js'
import { Avatar, Button, Card, Empty, FilePick, Modal, PostSkeleton, useLightbox } from './ui.jsx'
import { Icon } from './Icon.jsx'

const POST_SELECT = '*, author:profiles(id,username,display_name,avatar_url), reactions(count), comments(count)'
const PAGE = 12

/* ───── Report ───── */
export function ReportButton({ type, id, className = '', label }) {
  const { user } = useAuth(); const { t } = useT(); const toast = useToast()
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!reason.trim()) return
    setBusy(true)
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: type, target_id: String(id), reason: reason.trim().slice(0, 500) })
    setBusy(false)
    if (error) return toast(errText(error, t), 'error')
    toast(t('report_sent'), 'ok'); setOpen(false); setReason('')
  }
  return (
    <>
      <button className={className || 'flex items-center gap-1 text-xs text-muted hover:text-danger'} onClick={() => setOpen(true)}>
        <Icon name="flag" size={14} />{label ?? t('report')}
      </button>
      {open && (
        <Modal title={t('report')} onClose={() => setOpen(false)}>
          <p className="mb-2 text-sm text-muted">{t('reportReason')}</p>
          <textarea className="input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button><Button busy={busy} onClick={send}>{t('send')}</Button></div>
        </Modal>
      )}
    </>
  )
}

/* ───── Composer ("What's on your mind?") ───── */
export function Composer({ onPosted }) {
  const { user, me } = useAuth(); const { t } = useT(); const toast = useToast()
  const [body, setBody] = useState(''); const [file, setFile] = useState(null); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState(false)
  useEffect(() => { if (!file) { setPreview(null); return } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u) }, [file])
  const post = async () => {
    if (!body.trim() && !file) return
    setBusy(true)
    try {
      const image_url = file ? await uploadImage(user.id, file) : null
      const { data, error } = await supabase.from('posts').insert({ author_id: user.id, body: body.trim(), image_url }).select(POST_SELECT).single()
      if (error) throw error
      setBody(''); setFile(null); setFocus(false); onPosted?.(data)
    } catch (e) { toast(errText(e, t), 'error') }
    setBusy(false)
  }
  return (
    <Card hud i={0} className="space-y-3">
      <div className="flex gap-3">
        <Avatar p={me} size={42} />
        <textarea className="input !rounded-2xl" rows={focus || body ? 3 : 1} maxLength={10000} value={body}
          placeholder={t('whatsup', { name: me?.display_name || me?.username || '' })}
          onFocus={() => setFocus(true)} onChange={(e) => setBody(e.target.value)} />
      </div>
      {preview && (
        <div className="relative fade">
          <img src={preview} alt="" className="max-h-72 w-full rounded-xl object-cover" />
          <button className="round-btn absolute right-2 top-2 !bg-black/60" onClick={() => setFile(null)} aria-label="Remove"><Icon name="x" size={16} /></button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <FilePick onPick={(f) => { setFile(f); setFocus(true) }}>
          <span className="btn btn-soft btn-sm"><Icon name="image" size={16} />{t('photo')}</span>
        </FilePick>
        <Button onClick={post} busy={busy} disabled={!body.trim() && !file} icon="send">{t('post')}</Button>
      </div>
    </Card>
  )
}

/* ───── Comments ───── */
function Comments({ postId, onCount }) {
  const { user, me } = useAuth(); const { t, lang } = useT(); const toast = useToast()
  const [list, setList] = useState(null); const [text, setText] = useState(''); const [reply, setReply] = useState(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*, profiles(username,display_name,avatar_url)').eq('post_id', postId).order('created_at').limit(200)
    setList(data || []); onCount?.((data || []).length)
  }, [postId])
  useEffect(() => { load() }, [load])
  const send = async () => {
    if (!text.trim()) return
    const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: user.id, body: text.trim(), parent_id: reply?.id || null })
    if (error) return toast(errText(error, t), 'error')
    setText(''); setReply(null); load()
  }
  const del = async (id) => { await supabase.from('comments').delete().eq('id', id); load() }
  const row = (c, indent) => (
    <div key={c.id} className={`fade flex gap-2 ${indent ? 'ml-9' : ''}`}>
      <button onClick={() => go(profilePath(c.profiles?.username))}><Avatar p={c.profiles} size={indent ? 26 : 32} /></button>
      <div className="min-w-0">
        <div className="rounded-2xl bg-panel2 px-3 py-2 text-sm">
          <button className="font-semibold hover:text-accent" onClick={() => go(profilePath(c.profiles?.username))}>{nameOf(c.profiles)}</button>
          <p className="whitespace-pre-wrap break-words">{c.body}</p>
        </div>
        <div className="mt-1 flex gap-3 px-2 text-xs text-muted">
          <span>{timeAgo(c.created_at, lang)}</span>
          {!indent && <button className="font-semibold hover:text-accent" onClick={() => setReply(c)}>{t('reply')}</button>}
          {c.author_id === user.id && <button className="hover:text-danger" onClick={() => del(c.id)}>{t('delete')}</button>}
        </div>
      </div>
    </div>
  )
  if (!list) return <div className="py-3"><div className="skeleton h-8 w-full" /></div>
  const top = list.filter((c) => !c.parent_id)
  return (
    <div className="space-y-3 pt-3">
      {top.map((c) => <div key={c.id} className="space-y-2">{row(c, false)}{list.filter((r) => r.parent_id === c.id).map((r) => row(r, true))}</div>)}
      {reply && <p className="text-xs text-muted">↩ {t('replyingTo', { name: nameOf(reply.profiles) })} <button className="link" onClick={() => setReply(null)}>✕</button></p>}
      <div className="flex gap-2">
        <Avatar p={me} size={32} />
        <input className="input !rounded-full !py-2" value={text} maxLength={3000} placeholder={t('writeComment')}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="round-btn !bg-accent !text-[#1a1205]" onClick={send} aria-label={t('send')}><Icon name="send" size={16} /></button>
      </div>
    </div>
  )
}

/* ───── Post card ───── */
export function PostCard({ post, myLiked, onRemove, i = 0 }) {
  const { user } = useAuth(); const { t, lang } = useT(); const toast = useToast(); const zoom = useLightbox()
  const [liked, setLiked] = useState(myLiked)
  const [likes, setLikes] = useState(post.reactions?.[0]?.count || 0)
  const [cc, setCc] = useState(post.comments?.[0]?.count || 0)
  const [open, setOpen] = useState(false); const [burst, setBurst] = useState(0); const [menu, setMenu] = useState(false)
  const mine = post.author_id === user.id
  const toggle = async () => {
    const was = liked
    setLiked(!was); setLikes((n) => n + (was ? -1 : 1)); if (!was) setBurst((b) => b + 1)
    const r = was
      ? await supabase.from('reactions').delete().eq('post_id', post.id).eq('user_id', user.id)
      : await supabase.from('reactions').insert({ post_id: post.id, user_id: user.id })
    if (r.error) { setLiked(was); setLikes((n) => n + (was ? 1 : -1)); toast(errText(r.error, t), 'error') }
  }
  const remove = async () => {
    if (!confirm(t('confirm_delete_post'))) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) toast(errText(error, t), 'error'); else onRemove?.(post.id)
  }
  const a = post.author
  return (
    <Card i={Math.min(i, 6)} className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => go(profilePath(a?.username))}><Avatar p={a} size={42} /></button>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate font-semibold hover:text-accent" onClick={() => go(profilePath(a?.username))}>{nameOf(a)}</button>
          <p className="text-xs text-muted">@{a?.username} · {timeAgo(post.created_at, lang)}</p>
        </div>
        <div className="relative">
          <button className="round-btn !h-8 !w-8" onClick={() => setMenu(!menu)} aria-label="More"><Icon name="more" size={18} /></button>
          {menu && (
            <div className="menu !w-44">
              {mine ? <button onClick={() => { setMenu(false); remove() }}><Icon name="trash" size={16} />{t('delete')}</button>
                : <ReportButton type="post" id={post.id} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm hover:bg-accent/15 hover:text-accent" />}
            </div>
          )}
        </div>
      </div>
      {post.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{post.body}</p>}
      {post.image_url && <img src={post.image_url} alt="" loading="lazy" className="zoomable max-h-[520px] w-full rounded-xl object-cover" onClick={() => zoom(post.image_url)} />}
      {(likes > 0 || cc > 0) && (
        <div className="flex justify-between text-xs text-muted">
          <span>{likes > 0 && <><Icon name="heart" size={12} className="mr-1 inline fill-accent text-accent" />{likes}</>}</span>
          <button className="hover:underline" onClick={() => setOpen(!open)}>{cc > 0 && t('n_comments', { n: cc })}</button>
        </div>
      )}
      <hr className="divider !my-0" />
      <div className="flex gap-2">
        <button onClick={toggle} className={`like-btn btn btn-soft flex-1 ${liked ? 'on' : ''}`}>
          <Icon name="heart" size={18} />{t('like')}
          {burst > 0 && Array.from({ length: 6 }, (_, k) => {
            const ang = (k / 6) * Math.PI * 2
            return <i key={`${burst}-${k}`} className="burst" style={{ '--bx': `${Math.cos(ang) * 26}px`, '--by': `${Math.sin(ang) * 26}px` }} />
          })}
        </button>
        <button onClick={() => setOpen(!open)} className="btn btn-soft flex-1"><Icon name="chat" size={18} />{t('comment')}</button>
        {!mine && <button onClick={() => go(`messages/${encodeURIComponent(a?.username)}`)} className="btn btn-soft hidden sm:inline-flex" aria-label={t('message')}><Icon name="send" size={18} /></button>}
      </div>
      {open && <Comments postId={post.id} onCount={setCc} />}
    </Card>
  )
}

/* ───── Feed (home, profile timeline) ───── */
export function PostFeed({ authorId = null, followingOnly = false, composer = false, empty }) {
  const { user } = useAuth(); const { t } = useT()
  const [posts, setPosts] = useState(null); const [liked, setLiked] = useState(new Set()); const [more, setMore] = useState(false); const [busy, setBusy] = useState(false)
  const scope = useRef('')

  const fetchPage = useCallback(async (from) => {
    let q = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    if (authorId) q = q.eq('author_id', authorId)
    if (followingOnly) {
      const { data } = await supabase.from('follows').select('followee_id').eq('follower_id', user.id)
      q = q.in('author_id', [user.id, ...(data || []).map((x) => x.followee_id)])
    }
    const { data, error } = await q
    const rows = error ? [] : data || []
    if (rows.length) {
      const { data: mine } = await supabase.from('reactions').select('post_id').eq('user_id', user.id).in('post_id', rows.map((r) => r.id))
      setLiked((s) => new Set([...s, ...(mine || []).map((m) => m.post_id)]))
    }
    return rows
  }, [authorId, followingOnly, user.id])

  useEffect(() => {
    let alive = true
    scope.current = `${authorId}|${followingOnly}`
    setPosts(null)
    fetchPage(0).then((rows) => { if (!alive) return; setPosts(rows); setMore(rows.length === PAGE) })
    return () => { alive = false }
  }, [fetchPage])

  const loadMore = async () => {
    setBusy(true)
    const rows = await fetchPage(posts.length)
    setPosts((p) => [...p, ...rows.filter((r) => !p.some((x) => x.id === r.id))]); setMore(rows.length === PAGE); setBusy(false)
  }

  return (
    <div className="space-y-4">
      {composer && <Composer onPosted={(p) => setPosts((l) => [p, ...(l || [])])} />}
      {posts === null && <><PostSkeleton /><PostSkeleton /></>}
      {posts?.map((p, i) => <PostCard key={p.id} post={p} i={i} myLiked={liked.has(p.id)} onRemove={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />)}
      {posts && !posts.length && <Card><Empty icon="tent">{empty || t('empty_feed')}</Empty></Card>}
      {more && <div className="text-center"><Button variant="ghost" busy={busy} onClick={loadMore}>{t('load_more')}</Button></div>}
    </div>
  )
}
