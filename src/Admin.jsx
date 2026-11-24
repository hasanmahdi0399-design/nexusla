import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { Button, Card } from './components/ui.jsx'

const inp = 'w-full rounded-xl bg-bg border border-white/10 px-3 py-2 text-ink outline-none focus:border-accent'

export function Announcement() {
  const [a, setA] = useState(null)
  useEffect(() => { supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1).then(r => setA(r.data?.[0] || null)) }, [])
  if (!a) return null
  return <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm"><b>📢 {a.title}</b> {a.body}</div>
}

export default function Admin({ role }) {
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState('reports'); const [rows, setRows] = useState([]); const [q, setQ] = useState('')
  const [ann, setAnn] = useState({ title: '', body: '' }); const [cat, setCat] = useState({ slug: '', name_en: '', name_zh: '', name_id: '' })
  const load = async () => {
    if (tab === 'reports') setRows((await supabase.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50)).data || [])
    if (tab === 'listings') setRows((await supabase.from('listings').select('id,title,status,profiles(username)').order('created_at', { ascending: false }).limit(30)).data || [])
    if (tab === 'users') {
      let r = supabase.from('profiles').select('id,username,user_code,role,status').order('created_at', { ascending: false }).limit(30)
      if (q) r = r.or(`username.ilike.%${q}%,user_code.ilike.%${q}%`)
      setRows((await r).data || [])
    }
    if (tab === 'logs') setRows((await supabase.from('moderation_logs').select('*').order('created_at', { ascending: false }).limit(50)).data || [])
  }
  useEffect(() => { load() }, [tab, q])
  const act = async (a, target, note) => {
    const { error } = await supabase.rpc('mod_action', { act: a, target: String(target), note: note || null })
    if (error) alert(error.message); load()
  }
  const B = ({ a, id, label, note }) => <button className="rounded-lg border border-white/10 px-2 py-1 text-xs text-accent" onClick={() => act(a, id, note)}>{label}</button>
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex gap-2 overflow-x-auto">{['reports', 'listings', 'users', 'logs', ...(isAdmin ? ['site'] : [])].map(k =>
        <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-3 py-1 text-sm ${tab === k ? 'border-accent text-accent' : 'border-white/10 text-muted'}`}>{k}</button>)}</div>
      {tab === 'users' && <input className={inp} placeholder="Username or USR-ID" value={q} onChange={e => setQ(e.target.value)} />}
      {tab === 'reports' && rows.map(r => <Card key={r.id} className="space-y-2 text-sm"><p><b>{r.target_type}</b> {r.target_id}</p><p className="text-muted">{r.reason}</p>
        <div className="flex flex-wrap gap-2">
          {r.target_type === 'listing' && <B a="remove_listing" id={r.target_id} label="Remove listing" note={'report ' + r.id} />}
          {r.target_type === 'post' && <B a="delete_post" id={r.target_id} label="Delete post" note={'report ' + r.id} />}
          <B a="resolve_report" id={r.id} label="Resolve" /></div></Card>)}
      {tab === 'listings' && rows.map(l => <Card key={l.id} className="space-y-2 text-sm"><p>{l.title} · @{l.profiles?.username} · {l.status}</p>
        <div className="flex gap-2">{l.status === 'removed' ? <B a="restore_listing" id={l.id} label="Restore" /> : <B a="remove_listing" id={l.id} label="Remove" />}</div></Card>)}
      {tab === 'users' && rows.map(u => <Card key={u.id} className="space-y-2 text-sm"><p>@{u.username} · {u.user_code} · {u.role} · {u.status}</p>
        {isAdmin && u.role !== 'admin' && <div className="flex flex-wrap gap-2"><B a="suspend_user" id={u.id} label="Suspend" /><B a="ban_user" id={u.id} label="Ban" /><B a="activate_user" id={u.id} label="Activate" />
          {u.role === 'user' ? <B a="make_mod" id={u.id} label="Make mod" /> : <B a="make_user" id={u.id} label="Remove mod" />}</div>}</Card>)}
      {tab === 'logs' && rows.map(l => <Card key={l.id} className="text-xs text-muted">{new Date(l.created_at).toLocaleString()} · {l.action} · {l.target}</Card>)}
      {tab === 'site' && <>
        <Card className="space-y-2"><b>Announcement</b>
          <input className={inp} placeholder="Title" onChange={e => setAnn({ ...ann, title: e.target.value })} />
          <input className={inp} placeholder="Text" onChange={e => setAnn({ ...ann, body: e.target.value })} />
          <Button onClick={async () => { await supabase.from('announcements').insert({ ...ann, created_by: (await supabase.auth.getUser()).data.user.id }); alert('Posted') }}>Post</Button></Card>
        <Card className="space-y-2"><b>New category</b>
          {['slug', 'name_en', 'name_zh', 'name_id'].map(k => <input key={k} className={inp} placeholder={k} onChange={e => setCat({ ...cat, [k]: e.target.value })} />)}
          <Button onClick={async () => { const { error } = await supabase.from('listing_categories').insert(cat); alert(error ? error.message : 'Added') }}>Add</Button></Card></>}
    </div>
  )
}
