import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from './lib/supabase.js'
import { Button, Card } from './components/ui.jsx'
import { useLang, LANGS } from './i18n/index.js'
import { PostActions, Notifications, ReportButton } from './Social.jsx'
import Admin, { Announcement } from './Admin.jsx'
import Legal from './Legal.jsx'
import { Discover, Friends, Stories, Settings, SellerReviews } from './Community.jsx'

const inp = 'w-full rounded-xl bg-bg border border-white/10 px-3 py-3 text-ink outline-none focus:border-accent'
const ago = (d) => new Date(d).toLocaleDateString()

async function upload(uid, file) {
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 2097152) throw new Error('Image only, max 2 MB')
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`
  const { error } = await supabase.storage.from('media').upload(path, file)
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

function Auth({ t }) {
  const [mode, setMode] = useState('login'); const [f, setF] = useState({ email:'', password:'', username:'' }); const [msg, setMsg] = useState('')
  const go = async () => {
    const r = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      : await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { username: f.username } } })
    setMsg(r.error ? r.error.message : mode === 'signup' ? 'Check your email to verify your account.' : '')
  }
  return (
    <Card className="mx-auto mt-10 max-w-sm space-y-3">
      <h2 className="text-xl font-bold">{t(mode)}</h2>
      {mode === 'signup' && <input className={inp} placeholder={t('username')} minLength={3} maxLength={24} onChange={e => setF({ ...f, username: e.target.value })} />}
      <input className={inp} placeholder={t('email')} type="email" onChange={e => setF({ ...f, email: e.target.value })} />
      <input className={inp} placeholder={t('password')} type="password" minLength={8} onChange={e => setF({ ...f, password: e.target.value })} />
      <Button className="w-full" onClick={go}>{t(mode)}</Button>
      {mode === 'login' && <button className="text-sm text-muted" onClick={async()=>{if(!f.email){setMsg('Enter your email first.');return}const r=await supabase.auth.resetPasswordForEmail(f.email,{redirectTo:location.origin});setMsg(r.error?.message||'Password reset email sent.')}}>Forgot password?</button>}
      <button className="text-sm text-accent" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{t(mode === 'login' ? 'signup' : 'login')}</button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </Card>
  )
}

function Market({ t, lang, user, contact }) {
  const [items, setItems] = useState([]); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [cats, setCats] = useState([]); const [show, setShow] = useState(false)
  const [f, setF] = useState({ title:'', description:'', price:'', type:'sale', category_id:'', server:'' }); const [files, setFiles] = useState([]); const [err, setErr] = useState(''); const [reviewSeller, setReviewSeller] = useState(null)
  const load = async () => {
    let r = supabase.from('listings').select('*, profiles(username), listing_media(url)').neq('status','removed').order('created_at', { ascending: false }).limit(40)
    if (q) { const term = q.replace(/[,%()]/g, ''); r = r.or(`title.ilike.%${term}%,description.ilike.%${term}%,server.ilike.%${term}%`) } if (type) r = r.eq('type', type)
    setItems((await r).data || [])
  }
  useEffect(() => { supabase.from('listing_categories').select('*').then(r => setCats(r.data || [])) }, [])
  useEffect(() => { load() }, [q, type])
  const create = async () => {
    try {
      setErr('')
      const { data, error } = await supabase.from('listings').insert({ ...f, price: f.price === '' ? null : Number(f.price), category_id: f.category_id || null, seller_id: user.id }).select().single()
      if (error) throw error
      for (const [i, file] of files.slice(0, 5).entries()) await supabase.from('listing_media').insert({ listing_id: data.id, url: await upload(user.id, file), position: i })
      setShow(false); setFiles([]); load()
    } catch (e) { setErr(e.message) }
  }
  const sold = async (id) => { await supabase.from('listings').update({ status: 'sold' }).eq('id', id); load() }
  return (
    <div className="space-y-4">
      {reviewSeller && <Card><button className="mb-3 text-sm text-accent" onClick={()=>setReviewSeller(null)}>← Back to listings</button><SellerReviews user={user} sellerId={reviewSeller}/></Card>}
      <p className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-muted">⚠️ {t('safety')}</p>
      <div className="flex gap-2"><input className={inp} placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} /><Button onClick={() => setShow(!show)}>＋</Button></div>
      <div className="flex gap-2 overflow-x-auto">{['', 'sale', 'wanted', 'trade', 'giveaway'].map(k => <button key={k} onClick={() => setType(k)} className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${type === k ? 'border-accent text-accent' : 'border-white/10 text-muted'}`}>{t(k || 'all')}</button>)}</div>
      {show && <Card className="space-y-3">
        <input className={inp} placeholder={t('title')} onChange={e => setF({ ...f, title: e.target.value })} />
        <textarea className={inp} placeholder={t('desc')} onChange={e => setF({ ...f, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} placeholder={t('price')} type="number" onChange={e => setF({ ...f, price: e.target.value })} />
          <input className={inp} placeholder={t('server')} onChange={e => setF({ ...f, server: e.target.value })} />
          <select className={inp} onChange={e => setF({ ...f, type: e.target.value })}>{['sale', 'wanted', 'trade', 'giveaway'].map(k => <option key={k} value={k}>{t(k)}</option>)}</select>
          <select className={inp} onChange={e => setF({ ...f, category_id: e.target.value })}><option value="">{t('category')}</option>{cats.map(c => <option key={c.id} value={c.id}>{c['name_' + lang]}</option>)}</select>
        </div>
        <input type="file" accept="image/*" multiple className="text-sm text-muted" onChange={e => setFiles([...e.target.files])} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button className="w-full" onClick={create}>{t('publish')}</Button>
      </Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(i => <Card key={i.id} className="space-y-2">
          {i.listing_media?.[0] && <img loading="lazy" src={i.listing_media[0].url} className="h-40 w-full rounded-xl object-cover" />}
          <div className="flex justify-between"><h3 className="font-bold">{i.title}</h3><span className="text-accent">{i.price ?? ''} {i.price != null && i.currency}</span></div>
          <p className="text-sm text-muted">{i.description}</p>
          <p className="text-xs text-muted">{t(i.type)} · {i.server} · @{i.profiles?.username} · {ago(i.created_at)} · {i.status}</p>
          {i.seller_id === user.id ? (i.status === 'available' && <Button variant="ghost" className="w-full" onClick={() => sold(i.id)}>{t('sold')}</Button>)
            : <Button className="w-full" onClick={() => contact(i.seller_id)}>{t('contact')}</Button>}
          {i.seller_id !== user.id && <div className="flex items-center justify-between"><ReportButton type="listing" id={i.id} user={user} t={t} /><button className="text-xs text-accent" onClick={()=>setReviewSeller(i.seller_id)}>Seller reviews</button></div>}
        </Card>)}
      </div>
    </div>
  )
}

function Feed({ t, user }) {
  const [posts, setPosts] = useState([]); const [body, setBody] = useState(''); const [file, setFile] = useState(null)
  const load = async () => setPosts((await supabase.from('posts').select('*, profiles(username)').order('created_at', { ascending: false }).limit(20)).data || [])
  useEffect(() => { load() }, [])
  const post = async () => {
    if (!body.trim()) return
    await supabase.from('posts').insert({ body, author_id: user.id, image_url: file ? await upload(user.id, file) : null })
    setBody(''); setFile(null); load()
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card className="space-y-2"><textarea className={inp} placeholder={t('whatsup')} value={body} onChange={e => setBody(e.target.value)} />
        <div className="flex items-center justify-between"><input type="file" accept="image/*" className="text-sm text-muted" onChange={e => setFile(e.target.files[0])} /><Button onClick={post}>{t('post')}</Button></div></Card>
      {posts.map(p => <Card key={p.id}><p className="text-xs text-muted">@{p.profiles?.username} · {ago(p.created_at)}</p><p className="mt-1 whitespace-pre-wrap">{p.body}</p>{p.image_url && <img loading="lazy" src={p.image_url} className="mt-2 rounded-xl" />}<div className="flex items-center justify-between"><PostActions post={p} user={user} t={t} />{p.author_id === user.id && <button className="text-xs text-red-300" onClick={async()=>{if(confirm('Delete this post?')){const {error}=await supabase.from('posts').delete().eq('id',p.id).eq('author_id',user.id);if(!error)load()}}}>Delete post</button>}</div></Card>)}
      {!posts.length && <p className="text-muted">{t('empty')}</p>}
    </div>
  )
}

function Messages({ t, user, peer, setPeer }) {
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const [people, setPeople] = useState([])
  const load = async () => {
    if (peer) {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${peer}),and(sender_id.eq.${peer},receiver_id.eq.${user.id})`).order('created_at').limit(100)
      setMsgs(data || [])
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('receiver_id', user.id).eq('sender_id', peer).is('read_at', null)
    } else {
      const { data } = await supabase.from('messages').select('sender_id,receiver_id').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(100)
      const ids = [...new Set((data || []).map(m => m.sender_id === user.id ? m.receiver_id : m.sender_id))]
      setPeople(ids.length ? (await supabase.from('profiles').select('id,username').in('id', ids)).data || [] : [])
    }
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('m-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, load).subscribe()
    return () => supabase.removeChannel(ch)
  }, [peer])
  const send = async () => { if (!text.trim()) return; await supabase.from('messages').insert({ sender_id: user.id, receiver_id: peer, body: text }); setText(''); load() }
  if (!peer) return <div className="mx-auto max-w-xl space-y-2">{people.map(p => <Card key={p.id} className="cursor-pointer" onClick={() => setPeer(p.id)}>@{p.username}</Card>)}{!people.length && <p className="text-muted">{t('empty')}</p>}</div>
  return (
    <div className="mx-auto max-w-xl space-y-2">
      <button className="text-accent" onClick={() => setPeer(null)}>←</button>
      {msgs.map(m => <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.sender_id === user.id ? 'ml-auto bg-accent text-bg' : 'bg-panel'}`}>{m.body}</div>)}
      <div className="flex gap-2"><input className={inp} value={text} onChange={e => setText(e.target.value)} /><Button onClick={send}>{t('send')}</Button></div>
    </div>
  )
}

function Me({ t, user }) {
  const [p, setP] = useState(null)
  useEffect(() => { supabase.from('profiles').select('*').eq('id', user.id).single().then(r => setP(r.data)) }, [])
  const save = async (patch) => { await supabase.from('profiles').update(patch).eq('id', user.id); setP({ ...p, ...patch }) }
  const pic = async (key, file) => file && save({ [key]: await upload(user.id, file) })
  if (!p) return null
  return (
    <Card className="mx-auto max-w-xl space-y-3">
      {p.banner_url && <img src={p.banner_url} className="h-32 w-full rounded-xl object-cover" />}
      <div className="flex items-center gap-3">{p.avatar_url && <img src={p.avatar_url} className="h-16 w-16 rounded-full object-cover" />}
        <div><p className="font-bold">{p.display_name} <span className="text-muted">@{p.username}</span></p>
          <button className="text-sm text-accent" onClick={() => navigator.clipboard.writeText(p.user_code)}>{p.user_code} · {t('copy')}</button></div></div>
      <label className="block text-sm text-muted">Avatar (GIF ok)<input type="file" accept="image/*" onChange={e => pic('avatar_url', e.target.files[0])} /></label>
      <label className="block text-sm text-muted">Banner (GIF ok)<input type="file" accept="image/*" onChange={e => pic('banner_url', e.target.files[0])} /></label>
      <input className={inp} placeholder="Bio" defaultValue={p.bio || ''} onBlur={e => save({ bio: e.target.value })} />
      <input className={inp} placeholder="LifeAfter nickname" defaultValue={p.game_nick || ''} onBlur={e => save({ game_nick: e.target.value })} />
      <input className={inp} placeholder={t('server')} defaultValue={p.server || ''} onBlur={e => save({ server: e.target.value })} />
      <SellerReviews user={user} sellerId={user.id} />
      <Button variant="ghost" onClick={() => supabase.auth.signOut()}>{t('logout')}</Button>
    </Card>
  )
}

export default function App() {
  const { lang, setLang, t } = useLang()
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false); const [page, setPage] = useState('market'); const [peer, setPeer] = useState(null); const [role, setRole] = useState('user')
  useEffect(() => {
    if (!supabaseReady) return
    supabase.auth.getSession().then(r => { setUser(r.data.session?.user ?? null); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (user) supabase.from('profiles').select('role').eq('id', user.id).single().then(r => setRole(r.data?.role || 'user')) }, [user])
  const tabs = [['market', '🛒'], ['feed', '📰'], ['discover', '🔎'], ['stories', '⭕'], ['friends', '🤝'], ['messages', '💬'], ['notifications', '🔔'], ['me', '👤'], ['settings', '⚙️'], ...(role !== 'user' ? [['admin', '🛡️']] : [])]
  const Langs = () => <select className="rounded-lg bg-panel p-2 text-sm" value={lang} onChange={e => setLang(e.target.value)}>{LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
  const Logo = <h1 className="text-2xl font-extrabold">NEX<span className="text-accent">US</span></h1>
  if (!supabaseReady) return <p className="p-6 text-muted">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Cloudflare, then redeploy.</p>
  if (!ready) return null
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 md:hidden">{Logo}<Langs /></header>
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col gap-2 border-r border-white/5 bg-panel p-4 md:flex">
        {Logo}<p className="mb-4 text-xs text-muted">BUY. SELL. TRADE. CONNECT.</p>
        {user && tabs.map(([k, i]) => <button key={k} onClick={() => { setPage(k); setPeer(null) }} className={`rounded-xl px-3 py-3 text-left ${page === k ? 'bg-accent text-bg' : 'text-muted hover:text-accent'}`}>{i} {t(k)}</button>)}
        <div className="mt-auto"><Langs /></div>
      </aside>
      <main className="p-4 pb-24 md:ml-56 md:p-8">
        <Announcement />
        {page === 'legal' ? <Legal lang={lang} /> : !user ? <Auth t={t} /> : page === 'market' ? <Market t={t} lang={lang} user={user} contact={id => { setPeer(id); setPage('messages') }} />
          : page === 'feed' ? <Feed t={t} user={user} /> : page === 'discover' ? <Discover user={user} upload={upload} /> : page === 'stories' ? <Stories user={user} upload={upload} /> : page === 'friends' ? <Friends user={user} /> : page === 'settings' ? <Settings user={user} /> : page === 'messages' ? <Messages t={t} user={user} peer={peer} setPeer={setPeer} /> : page === 'notifications' ? <Notifications t={t} user={user} /> : page === 'admin' && role !== 'user' ? <Admin role={role} /> : <Me t={t} user={user} />}
        <p className="mt-10 text-xs text-muted">Independent fan-made platform. Not affiliated with NetEase Games or LifeAfter. <button className="text-accent" onClick={() => setPage(page === 'legal' ? 'market' : 'legal')}>{t('legal')}</button></p>
      </main>
      {user && <nav className="fixed inset-x-0 bottom-0 flex justify-around overflow-x-auto border-t border-white/5 bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map(([k, i]) => <button key={k} onClick={() => { setPage(k); setPeer(null) }} className={`min-w-0 flex-1 px-2 py-3 text-xl ${page === k ? 'text-accent' : 'text-muted'}`}>{i}</button>)}</nav>}
    </div>
  )
}
