import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'

const inp = 'w-full rounded-xl bg-bg border border-white/10 px-3 py-2 text-ink outline-none focus:border-accent'

export function PostActions({ post, user, t }) {
  const [likes, setLikes] = useState(0); const [liked, setLiked] = useState(false)
  const [open, setOpen] = useState(false); const [cs, setCs] = useState([]); const [text, setText] = useState(''); const [reply, setReply] = useState(null)
  const [following, setFollowing] = useState(false)
  const loadLikes = async () => {
    const { data } = await supabase.from('reactions').select('user_id').eq('post_id', post.id)
    setLikes(data?.length || 0); setLiked(!!data?.some(r => r.user_id === user.id))
  }
  const loadComments = async () => setCs((await supabase.from('comments').select('*, profiles(username)').eq('post_id', post.id).order('created_at').limit(100)).data || [])
  useEffect(() => {
    loadLikes()
    if (post.author_id !== user.id) supabase.from('follows').select('followee_id').eq('follower_id', user.id).eq('followee_id', post.author_id).then(r => setFollowing(!!r.data?.length))
  }, [])
  useEffect(() => { if (open) loadComments() }, [open])
  const like = async () => {
    if (liked) await supabase.from('reactions').delete().eq('post_id', post.id).eq('user_id', user.id)
    else await supabase.from('reactions').insert({ post_id: post.id, user_id: user.id })
    loadLikes()
  }
  const follow = async () => {
    if (following) await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', post.author_id)
    else await supabase.from('follows').insert({ follower_id: user.id, followee_id: post.author_id })
    setFollowing(!following)
  }
  const send = async () => {
    if (!text.trim()) return
    await supabase.from('comments').insert({ post_id: post.id, author_id: user.id, body: text, parent_id: reply })
    setText(''); setReply(null); loadComments()
  }
  const del = async (id) => { await supabase.from('comments').delete().eq('id', id); loadComments() }
  const top = cs.filter(c => !c.parent_id)
  const row = (c, indent) => (
    <div key={c.id} className={`rounded-xl bg-bg p-2 text-sm ${indent ? 'ml-6' : ''}`}>
      <span className="text-muted">@{c.profiles?.username}</span> {c.body}
      <div className="mt-1 flex gap-3 text-xs text-accent">
        {!indent && <button onClick={() => setReply(c.id)}>{t('reply')}</button>}
        {c.author_id === user.id && <button onClick={() => del(c.id)}>✕</button>}
      </div>
    </div>
  )
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-4 text-sm">
        <button onClick={like} className={liked ? 'text-accent' : 'text-muted'}>♥ {likes}</button>
        <button onClick={() => setOpen(!open)} className="text-muted">💬 {t('comment')}</button>
        {post.author_id !== user.id && <ReportButton type="post" id={post.id} user={user} t={t} />}
        {post.author_id !== user.id && <button onClick={follow} className="ml-auto text-accent">{following ? t('unfollow') : t('follow')}</button>}
      </div>
      {open && <div className="space-y-2">
        {top.map(c => <div key={c.id} className="space-y-1">{row(c, false)}{cs.filter(r => r.parent_id === c.id).map(r => row(r, true))}</div>)}
        {reply && <p className="text-xs text-muted">↩ {t('reply')} <button className="text-accent" onClick={() => setReply(null)}>✕</button></p>}
        <div className="flex gap-2"><input className={inp} value={text} onChange={e => setText(e.target.value)} /><button className="rounded-xl bg-accent px-4 font-semibold text-bg" onClick={send}>{t('send')}</button></div>
      </div>}
    </div>
  )
}

export function Notifications({ t, user, onUnread }) {
  const [list, setList] = useState([])
  const load = async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setList(data || []); onUnread?.((data || []).filter(n => !n.read).length)
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('n-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
  const markAll = async () => { await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false); load() }
  return (
    <div className="mx-auto max-w-xl space-y-2">
      <button className="text-sm text-accent" onClick={markAll}>{t('markAll')}</button>
      {list.map(n => (
        <div key={n.id} className={`rounded-2xl border p-3 ${n.read ? 'border-white/5 bg-panel text-muted' : 'border-accent/40 bg-panel'}`}>
          <b>@{n.data?.who}</b> {t('n_' + n.kind)}
          <p className="text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p>
        </div>
      ))}
      {!list.length && <p className="text-muted">{t('empty')}</p>}
    </div>
  )
}

export function ReportButton({ type, id, user, t }) {
  const [done, setDone] = useState(false)
  const go = async () => {
    const reason = prompt(t('reportReason'))
    if (!reason) return
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: type, target_id: String(id), reason: reason.slice(0, 500) })
    if (!error) setDone(true)
  }
  return <button className="text-xs text-muted" disabled={done} onClick={go}>{done ? '✓' : '⚑ ' + t('report')}</button>
}
