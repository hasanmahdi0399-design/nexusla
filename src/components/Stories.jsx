import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { errText, nameOf, timeAgo, uploadImage } from '../lib/util.js'
import { Avatar, Button, FilePick, Modal } from './ui.jsx'
import { Icon } from './Icon.jsx'

const DURATION = 5 // seconds per story

/* 24-hour stories: a row at the top of Home, tap to watch. */
export default function Stories() {
  const { user, me } = useAuth(); const { t, lang } = useT(); const toast = useToast()
  const [rows, setRows] = useState(null); const [watch, setWatch] = useState(null); const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('stories')
      .select('id,author_id,media_url,caption,created_at,expires_at,profiles(id,username,display_name,avatar_url)')
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(120)
    if (error) { setRows([]); return }
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const m = new Map()
    for (const s of rows || []) { if (!m.has(s.author_id)) m.set(s.author_id, { author: s.profiles, id: s.author_id, items: [] }); m.get(s.author_id).items.push(s) }
    const all = [...m.values()]
    return [...all.filter((g) => g.id === user.id), ...all.filter((g) => g.id !== user.id).reverse()]
  }, [rows, user.id])

  const del = async (id) => {
    const { error } = await supabase.from('stories').delete().eq('id', id)
    if (error) toast(errText(error, t), 'error'); else { setWatch(null); load() }
  }

  return (
    <>
      <div className="noscroll rise -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <button className="story-card" onClick={() => setCreating(true)}>
          <div className="absolute inset-0 grid place-items-center" style={{ background: 'linear-gradient(160deg, rgb(var(--panel2)), rgb(var(--bg)))' }}>
            <div className="absolute inset-x-0 top-0 h-[60%] overflow-hidden">
              {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover opacity-80" /> : <div className="h-full w-full bg-mist/10" />}
            </div>
          </div>
          <span className="absolute left-1/2 top-[60%] z-[2] grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-[#1a1205] shadow-lg ring-4 ring-panel"><Icon name="plus" size={20} /></span>
          <span className="absolute inset-x-2 bottom-2 z-[2] text-center text-xs font-semibold">{t('add_story')}</span>
        </button>
        {rows === null && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton story-card" />)}
        {groups.map((g) => {
          const last = g.items[g.items.length - 1]
          return (
            <button key={g.id} className="story-card" onClick={() => setWatch({ gi: groups.indexOf(g), si: 0 })}>
              <img className="bg" src={last.media_url} alt="" loading="lazy" />
              <span className="story-ring"><Avatar p={g.author} size={34} /></span>
              <span className="absolute inset-x-2 bottom-2 z-[2] truncate text-xs font-semibold">{g.id === user.id ? t('your_story') : nameOf(g.author)}</span>
            </button>
          )
        })}
      </div>
      {creating && <StoryComposer onClose={() => setCreating(false)} onDone={() => { setCreating(false); load() }} />}
      {watch && groups[watch.gi] && <Viewer groups={groups} start={watch} onClose={() => setWatch(null)} onDelete={del} lang={lang} t={t} meId={user.id} />}
    </>
  )
}

function StoryComposer({ onClose, onDone }) {
  const { user } = useAuth(); const { t } = useT(); const toast = useToast()
  const [file, setFile] = useState(null); const [preview, setPreview] = useState(null); const [caption, setCaption] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { if (!file) return setPreview(null); const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u) }, [file])
  const share = async () => {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(user.id, file, 1280)
      const { error } = await supabase.from('stories').insert({ author_id: user.id, media_url: url, caption: caption.trim(), expires_at: new Date(Date.now() + 86400000).toISOString() })
      if (error) throw error
      toast(t('story_shared'), 'ok'); onDone()
    } catch (e) { toast(errText(e, t), 'error') }
    setBusy(false)
  }
  return (
    <Modal title={t('add_story')} onClose={onClose}>
      <div className="space-y-3">
        {preview
          ? <img src={preview} alt="" className="mx-auto max-h-80 rounded-xl object-contain" />
          : <FilePick onPick={setFile}><div className="grid h-48 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-white/15 text-muted transition hover:border-accent hover:text-accent"><div className="text-center"><Icon name="camera" size={32} className="mx-auto mb-2" /><p className="text-sm">{t('pick_photo')}</p></div></div></FilePick>}
        {preview && <FilePick onPick={setFile}><span className="link text-sm">{t('change_photo')}</span></FilePick>}
        <input className="input" maxLength={300} placeholder={t('caption_optional')} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <p className="text-xs text-muted">{t('story_hint')}</p>
        <Button className="w-full" busy={busy} disabled={!file} onClick={share}>{t('share')}</Button>
      </div>
    </Modal>
  )
}

function Viewer({ groups, start, onClose, onDelete, lang, t, meId }) {
  const [gi, setGi] = useState(start.gi); const [si, setSi] = useState(start.si)
  const g = groups[gi]; const s = g.items[si]
  const next = useCallback(() => {
    if (si < g.items.length - 1) setSi(si + 1)
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0) }
    else onClose()
  }, [si, gi, g, groups.length, onClose])
  const prev = () => { if (si > 0) setSi(si - 1); else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].items.length - 1) } }
  useEffect(() => { const id = setTimeout(next, DURATION * 1000); return () => clearTimeout(id) }, [gi, si, next])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev() }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  })
  return createPortal(
    <div className="scrim fade" style={{ zIndex: 120, padding: 0, background: 'rgba(0,0,0,.94)' }}>
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden md:h-[92vh] md:rounded-2xl" style={{ background: '#000' }}>
        <div className="absolute inset-x-0 top-0 z-10 space-y-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <div className="flex gap-1">{g.items.map((x, k) => <div key={x.id} className={`sbar ${k < si ? 'done' : k === si ? 'run' : ''}`} style={{ '--dur': `${DURATION}s` }}><i key={`${gi}-${si}-${k}`} /></div>)}</div>
          <div className="flex items-center gap-2">
            <Avatar p={g.author} size={34} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameOf(g.author)}</p><p className="text-xs text-white/70">{timeAgo(s.created_at, lang)}</p></div>
            {g.id === meId && <button className="round-btn !bg-black/50" onClick={() => onDelete(s.id)} aria-label={t('delete')}><Icon name="trash" size={16} /></button>}
            <button className="round-btn !bg-black/50" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
          </div>
        </div>
        <img key={s.id} src={s.media_url} alt="" className="fade h-full w-full object-contain" />
        {s.caption && <p className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-5 pt-12 text-center text-sm">{s.caption}</p>}
        <button className="absolute inset-y-0 left-0 z-[5] w-1/3" onClick={prev} aria-label="Previous" />
        <button className="absolute inset-y-0 right-0 z-[5] w-2/3" onClick={next} aria-label="Next" />
      </div>
    </div>,
    document.body,
  )
}
