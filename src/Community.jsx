import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { Button, Card } from './components/ui.jsx'

const input = 'w-full rounded-xl bg-bg border border-white/10 px-3 py-3 text-ink outline-none focus:border-accent'
const time = (v) => new Date(v).toLocaleString()

export function Discover({ user, upload }) {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState([])
  const [status, setStatus] = useState({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const search = async () => {
    const q = query.trim().replace(/[,%()]/g, '')
    if (!q) { setPeople([]); return }
    const { data, error } = await supabase.from('profiles')
      .select('id,username,user_code,display_name,bio,avatar_url,server,game_nick')
      .or(`username.ilike.%${q}%,user_code.ilike.%${q}%`).neq('id', user.id).limit(25)
    if (error) setMessage(error.message)
    else setPeople(data || [])
  }
  useEffect(() => { search() }, [])
  const loadRelations = async (ids) => {
    if (!ids.length) return
    const [f, r] = await Promise.all([
      supabase.from('follows').select('followee_id').eq('follower_id', user.id).in('followee_id', ids),
      supabase.from('friend_requests').select('id,requester_id,recipient_id,status').or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).in('requester_id', [user.id, ...ids]).in('recipient_id', [user.id, ...ids]),
    ])
    const next = {}
    ;(f.data || []).forEach(x => { next[x.followee_id] = { ...(next[x.followee_id] || {}), following: true } })
    ;(r.data || []).forEach(x => {
      const other = x.requester_id === user.id ? x.recipient_id : x.requester_id
      next[other] = { ...(next[other] || {}), friend: x.status === 'accepted', request: x.status === 'pending' ? (x.requester_id === user.id ? 'sent' : 'received') : null, requestId: x.id }
    })
    setStatus(next)
  }
  useEffect(() => { loadRelations(people.map(p => p.id)) }, [people])
  const follow = async (id) => {
    setBusy(id)
    const current = status[id]?.following
    const res = current
      ? await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', id)
      : await supabase.from('follows').insert({ follower_id: user.id, followee_id: id })
    if (res.error) setMessage(res.error.message)
    setStatus(s => ({ ...s, [id]: { ...s[id], following: !current } }))
    setBusy('')
  }
  const friend = async (p) => {
    setBusy(p.id); setMessage('')
    const s = status[p.id] || {}
    let res
    if (s.request === 'sent') res = await supabase.from('friend_requests').update({ status: 'cancelled' }).eq('id', s.requestId)
    else if (s.request === 'received') res = await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', s.requestId)
    else if (s.friend) { setMessage('Already friends.'); setBusy(''); return }
    else res = await supabase.from('friend_requests').insert({ requester_id: user.id, recipient_id: p.id })
    if (res?.error) setMessage(res.error.message)
    await loadRelations([p.id]); setBusy('')
  }
  return <div className="mx-auto max-w-2xl space-y-4">
    <div><h2 className="text-xl font-bold">Discover players</h2><p className="text-sm text-muted">Search by username or permanent NEXUS user ID.</p></div>
    <div className="flex gap-2"><input className={input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Username or USR-XXXXXX"/><Button onClick={search}>Search</Button></div>
    {message && <p className="text-sm text-red-300">{message}</p>}
    {people.map(p => <Card key={p.id} className="flex items-center gap-3">
      {p.avatar_url ? <img src={p.avatar_url} className="h-14 w-14 rounded-full object-cover"/> : <div className="grid h-14 w-14 place-items-center rounded-full bg-bg text-xl">{(p.username||'?')[0].toUpperCase()}</div>}
      <div className="min-w-0 flex-1"><b>{p.display_name || p.username}</b><p className="text-sm text-muted">@{p.username} · {p.user_code}</p><p className="truncate text-xs text-muted">{p.game_nick || 'LifeAfter player'} {p.server ? '· '+p.server : ''}</p></div>
      <div className="flex flex-col gap-2"><Button onClick={()=>follow(p.id)} disabled={busy===p.id} variant="ghost">{status[p.id]?.following?'Following':'Follow'}</Button><Button onClick={()=>friend(p)} disabled={busy===p.id} size="sm">{status[p.id]?.friend?'Friends':status[p.id]?.request==='sent'?'Cancel request':status[p.id]?.request==='received'?'Accept':'Add friend'}</Button></div>
    </Card>)}
    {!people.length && query.trim() && <p className="text-sm text-muted">No matching players found.</p>}
  </div>
}

export function Friends({ user }) {
  const [requests,setRequests] = useState([]); const [friends,setFriends] = useState([]); const [error,setError] = useState('')
  const load = async () => {
    const {data,error} = await supabase.from('friend_requests').select('id,requester_id,recipient_id,status,created_at,requester:profiles!friend_requests_requester_id_fkey(username,avatar_url),recipient:profiles!friend_requests_recipient_id_fkey(username,avatar_url)').or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at',{ascending:false}).limit(100)
    if(error){setError(error.message);return}
    setRequests((data||[]).filter(x=>x.status==='pending'&&x.recipient_id===user.id))
    setFriends((data||[]).filter(x=>x.status==='accepted'))
  }
  useEffect(()=>{load()},[])
  const act = async (id,status) => { const {error}=await supabase.from('friend_requests').update({status}).eq('id',id); if(error)setError(error.message); load() }
  return <div className="mx-auto max-w-2xl space-y-5"><h2 className="text-xl font-bold">Friends</h2>{error&&<p className="text-sm text-red-300">{error}</p>}
    <section className="space-y-2"><h3 className="font-semibold">Incoming requests</h3>{requests.map(r=><Card key={r.id} className="flex items-center justify-between"><b>@{r.requester?.username}</b><div className="flex gap-2"><Button onClick={()=>act(r.id,'accepted')}>Accept</Button><Button variant="ghost" onClick={()=>act(r.id,'declined')}>Decline</Button></div></Card>)}{!requests.length&&<p className="text-sm text-muted">No pending requests.</p>}</section>
    <section className="space-y-2"><h3 className="font-semibold">Your friends</h3>{friends.map(r=>{const p=r.requester_id===user.id?r.recipient:r.requester;return <Card key={r.id}>@{p?.username}</Card>})}{!friends.length&&<p className="text-sm text-muted">No friends yet. Find players in Discover.</p>}</section>
  </div>
}

export function Stories({ user, upload }) {
  const [stories,setStories]=useState([]); const [file,setFile]=useState(null); const [caption,setCaption]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  const load=async()=>{const {data,error}=await supabase.from('stories').select('id,author_id,media_url,caption,created_at,expires_at,profiles(username,avatar_url)').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(60);if(error)setError(error.message);else setStories(data||[])}
  useEffect(()=>{load()},[])
  const publish=async()=>{if(!file){setError('Choose an image or GIF first.');return}setBusy(true);setError('');try{const url=await upload(user.id,file);const {error}=await supabase.from('stories').insert({author_id:user.id,media_url:url,caption,expires_at:new Date(Date.now()+86400000).toISOString()});if(error)throw error;setFile(null);setCaption('');await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const remove=async(id)=>{const {error}=await supabase.from('stories').delete().eq('id',id);if(error)setError(error.message);load()}
  return <div className="mx-auto max-w-3xl space-y-4"><div><h2 className="text-xl font-bold">Stories</h2><p className="text-sm text-muted">Photo and GIF stories disappear after 24 hours.</p></div><Card className="space-y-3"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setFile(e.target.files?.[0]||null)}/><input className={input} value={caption} maxLength={300} onChange={e=>setCaption(e.target.value)} placeholder="Add a caption (optional)"/><Button onClick={publish} disabled={busy}>{busy?'Publishing…':'Share story'}</Button>{error&&<p className="text-sm text-red-300">{error}</p>}</Card>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{stories.map(s=><Card key={s.id} className="space-y-2"><img src={s.media_url} className="h-52 w-full rounded-xl object-cover"/><p className="text-sm font-semibold">@{s.profiles?.username}</p>{s.caption&&<p className="text-sm text-muted">{s.caption}</p>}<p className="text-xs text-muted">Expires {time(s.expires_at)}</p>{s.author_id===user.id&&<Button variant="ghost" onClick={()=>remove(s.id)}>Delete</Button>}</Card>)}</div>
    {!stories.length&&<p className="text-sm text-muted">No active stories yet. Share the first one.</p>}</div>
}

export function Settings({ user }) {
  const [visibility,setVisibility]=useState('public'); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState(''); const [newPassword,setNewPassword]=useState('')
  useEffect(()=>{supabase.from('profiles').select('profile_visibility').eq('id',user.id).single().then(r=>{if(r.data)setVisibility(r.data.profile_visibility)})},[user.id])
  const save=async()=>{setBusy(true);const {error}=await supabase.from('profiles').update({profile_visibility:visibility}).eq('id',user.id);setMsg(error?.message||'Privacy setting saved.');setBusy(false)}
  const reset=async()=>{const {error}=await supabase.auth.resetPasswordForEmail(user.email,{redirectTo:location.origin});setMsg(error?.message||'Password reset email sent. Check your inbox.')}
  const del=async()=>{if(!confirm('Permanently delete your NEXUS account and profile? This cannot be undone.'))return;if(!confirm('Final confirmation: delete your account now?'))return;setBusy(true);const {error}=await supabase.functions.invoke('delete-account',{method:'POST'});if(error){setMsg('Account deletion failed: '+error.message);setBusy(false)}else{await supabase.auth.signOut();location.reload()}}
  return <div className="mx-auto max-w-xl space-y-4"><h2 className="text-xl font-bold">Account & privacy</h2><Card className="space-y-3"><h3 className="font-semibold">Profile visibility</h3><p className="text-sm text-muted">Private profiles are hidden from player discovery and public profile searches.</p><select className={input} value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Public</option><option value="private">Private</option></select><Button onClick={save} disabled={busy}>Save privacy</Button></Card><Card className="space-y-3"><h3 className="font-semibold">Password</h3><p className="text-sm text-muted">Send a password reset link to {user.email}.</p><Button variant="ghost" onClick={reset}>Send password reset email</Button><div className="space-y-2 border-t border-white/10 pt-3"><input className={input} type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (8+ characters)"/><Button onClick={async()=>{if(newPassword.length<8){setMsg('Password must be at least 8 characters.');return}const {error}=await supabase.auth.updateUser({password:newPassword});setMsg(error?.message||'Password updated.');if(!error)setNewPassword('')}}>Update password</Button></div></Card><Card className="space-y-3"><h3 className="font-semibold text-red-300">Delete account</h3><p className="text-sm text-muted">Permanently deletes your authentication account, related database records and media in your account folder.</p><Button variant="danger" disabled={busy} onClick={del}>Permanently delete account</Button></Card>{msg&&<p className="text-sm text-muted">{msg}</p>}</div>
}

export function SellerReviews({ user, sellerId }) {
  const [rows,setRows]=useState([]);const [rating,setRating]=useState(5);const [body,setBody]=useState('');const [error,setError]=useState('')
  const load=async()=>{const {data}=await supabase.from('seller_reviews').select('*,profiles!seller_reviews_reviewer_id_fkey(username)').eq('seller_id',sellerId).order('created_at',{ascending:false}).limit(30);setRows(data||[])}
  useEffect(()=>{load()},[sellerId])
  const submit=async()=>{const {error}=await supabase.from('seller_reviews').insert({seller_id:sellerId,reviewer_id:user.id,rating,body});setError(error?.message||'Review posted.');if(!error){setBody('');load()}}
  if(sellerId===user.id)return <div className="space-y-2"><b>Seller reviews</b>{rows.map(r=><Card key={r.id}>⭐ {r.rating}/5 · @{r.profiles?.username}<p>{r.body}</p></Card>)}</div>
  return <div className="space-y-2"><b>Seller reviews</b><Card className="space-y-2"><select className={input} value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select><textarea className={input} maxLength={1200} value={body} onChange={e=>setBody(e.target.value)} placeholder="Share your experience after contacting this seller"/><Button onClick={submit}>Submit review</Button>{error&&<p className="text-xs text-muted">{error}</p>}</Card>{rows.map(r=><Card key={r.id}>⭐ {r.rating}/5 · @{r.profiles?.username}<p>{r.body}</p></Card>)}{!rows.length&&<p className="text-sm text-muted">No reviews yet.</p>}</div>
}
