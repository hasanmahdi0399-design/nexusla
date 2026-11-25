import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { clean } from '../lib/util.js'
import { Button, Card, Empty } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'

export function Announcement() {
  const [a, setA] = useState(null)
  useEffect(() => { supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1).then((r) => setA(r.data?.[0] || null)) }, [])
  if (!a) return null
  return (
    <div className="rise flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
      <Icon name="megaphone" size={20} className="mt-0.5 flex-none text-accent" />
      <p><b>{a.title}</b> {a.body}</p>
    </div>
  )
}

// Staff panel: reports, listings, users, logs. (Admin-only: user actions + site settings.)
export default function Admin({ role }) {
  const { t } = useT(); const toast = useToast()
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState('reports'); const [rows, setRows] = useState([]); const [q, setQ] = useState('')
  const [ann, setAnn] = useState({ title: '', body: '' }); const [cat, setCat] = useState({ slug: '', name_en: '', name_zh: '', name_id: '' })

  const load = async () => {
    if (tab === 'reports') setRows((await supabase.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50)).data || [])
    if (tab === 'listings') setRows((await supabase.from('listings').select('id,title,status,profiles(username)').order('created_at', { ascending: false }).limit(30)).data || [])
    if (tab === 'users') {
      let r = supabase.from('profiles').select('id,username,user_code,role,status').order('created_at', { ascending: false }).limit(30)
      const term = clean(q.trim()); if (term) r = r.or(`username.ilike.%${term}%,user_code.ilike.%${term}%`)
      setRows((await r).data || [])
    }
    if (tab === 'logs') setRows((await supabase.from('moderation_logs').select('*').order('created_at', { ascending: false }).limit(50)).data || [])
  }
  useEffect(() => { load() }, [tab, q])
  const act = async (a, target, note) => {
    const { error } = await supabase.rpc('mod_action', { act: a, target: String(target), note: note || null })
    if (error) toast(error.message, 'error'); load()
  }
  const B = ({ a, id, label, note }) => <button className="btn btn-ghost btn-sm" onClick={() => act(a, id, note)}>{label}</button>

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="font-display text-3xl font-bold">{t('admin')}</h1>
      <div className="noscroll flex gap-2 overflow-x-auto">{['reports', 'listings', 'users', 'logs', ...(isAdmin ? ['site'] : [])].map((k) => <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'on' : ''}`}>{k}</button>)}</div>
      {tab === 'users' && <input className="input" placeholder="username / USR-ID" value={q} onChange={(e) => setQ(e.target.value)} />}
      {['reports', 'listings', 'users', 'logs'].includes(tab) && !rows.length && <Card><Empty icon="shield">{t('nothing_found')}</Empty></Card>}

      {tab === 'reports' && rows.map((r) => (
        <Card key={r.id} className="space-y-2 text-sm"><p><span className="tag amber">{r.target_type}</span> <span className="break-all text-xs text-muted">{r.target_id}</span></p><p>{r.reason}</p>
          <div className="flex flex-wrap gap-2">
            {r.target_type === 'listing' && <B a="remove_listing" id={r.target_id} label="Remove listing" note={'report ' + r.id} />}
            {r.target_type === 'post' && <B a="delete_post" id={r.target_id} label="Delete post" note={'report ' + r.id} />}
            <B a="resolve_report" id={r.id} label="Resolve" /></div></Card>
      ))}
      {tab === 'listings' && rows.map((l) => (
        <Card key={l.id} className="space-y-2 text-sm"><p>{l.title} · @{l.profiles?.username} · {l.status}</p>
          <div className="flex gap-2">{l.status === 'removed' ? <B a="restore_listing" id={l.id} label="Restore" /> : <B a="remove_listing" id={l.id} label="Remove" />}</div></Card>
      ))}
      {tab === 'users' && rows.map((u) => (
        <Card key={u.id} className="space-y-2 text-sm"><p>@{u.username} · {u.user_code} · {u.role} · {u.status}</p>
          {isAdmin && u.role !== 'admin' && <div className="flex flex-wrap gap-2"><B a="suspend_user" id={u.id} label="Suspend" /><B a="ban_user" id={u.id} label="Ban" /><B a="activate_user" id={u.id} label="Activate" />
            {u.role === 'user' ? <B a="make_mod" id={u.id} label="Make mod" /> : <B a="make_user" id={u.id} label="Remove mod" />}</div>}</Card>
      ))}
      {tab === 'logs' && rows.map((l) => <Card key={l.id} className="!p-3 text-xs text-muted">{new Date(l.created_at).toLocaleString()} · {l.action} · {l.target}</Card>)}

      {tab === 'site' && (
        <>
          <Card className="space-y-2"><b>Announcement</b>
            <input className="input" placeholder="Title" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
            <input className="input" placeholder="Text" value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
            <Button onClick={async () => { const { error } = await supabase.from('announcements').insert({ ...ann, created_by: (await supabase.auth.getUser()).data.user.id }); toast(error ? error.message : 'Posted', error ? 'error' : 'ok') }}>Post</Button></Card>
          <Card className="space-y-2"><b>New category</b>
            {['slug', 'name_en', 'name_zh', 'name_id'].map((k) => <input key={k} className="input" placeholder={k} value={cat[k]} onChange={(e) => setCat({ ...cat, [k]: e.target.value })} />)}
            <Button onClick={async () => { const { error } = await supabase.from('listing_categories').insert(cat); toast(error ? error.message : 'Added', error ? 'error' : 'ok') }}>Add</Button></Card>
        </>
      )}
    </div>
  )
}
