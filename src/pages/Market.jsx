import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath } from '../lib/router.js'
import { clean, errText, nameOf, timeAgo, uploadImage } from '../lib/util.js'
import { Avatar, Button, Card, Empty, FilePick, Modal, Skeleton, useLightbox } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { ReportButton } from '../components/Post.jsx'
import { SellerReviews } from './Reviews.jsx'

const TYPES = ['sale', 'wanted', 'trade', 'giveaway']
const TYPE_TAG = { sale: 'amber', wanted: '', trade: 'green', giveaway: 'green' }
const SELECT = '*, seller:profiles(id,username,display_name,avatar_url), listing_media(url,position)'

// The Trading Post: LifeAfter items for sale, wanted, trade or free.
export default function Market() {
  const { user } = useAuth(); const { t, lang } = useT(); const toast = useToast(); const zoom = useLightbox()
  const [items, setItems] = useState(null); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [cat, setCat] = useState('')
  const [cats, setCats] = useState([]); const [creating, setCreating] = useState(false); const [reviews, setReviews] = useState(null)

  const load = useCallback(async () => {
    let r = supabase.from('listings').select(SELECT).neq('status', 'removed').order('created_at', { ascending: false }).limit(60)
    const term = clean(q.trim())
    if (term) r = r.or(`title.ilike.%${term}%,description.ilike.%${term}%,server.ilike.%${term}%`)
    if (type) r = r.eq('type', type)
    if (cat) r = r.eq('category_id', cat)
    const { data } = await r
    setItems(data || [])
  }, [q, type, cat])
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id) }, [load])
  useEffect(() => { supabase.from('listing_categories').select('*').order('name_en').then((r) => setCats(r.data || [])) }, [])

  const sold = async (id) => { const { error } = await supabase.from('listings').update({ status: 'sold' }).eq('id', id); if (error) toast(errText(error, t), 'error'); load() }
  const del = async (id) => { if (!confirm(t('confirm_delete_listing'))) return; const { error } = await supabase.from('listings').delete().eq('id', id); if (error) toast(errText(error, t), 'error'); load() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold">{t('market')}</h1><p className="text-sm text-muted">{t('market_sub')}</p></div>
        <Button icon="plus" onClick={() => setCreating(true)}>{t('new_listing')}</Button>
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-muted"><Icon name="shield" size={16} className="mt-px flex-none text-accent" />{t('safety')}</p>

      <div className="relative"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input !pl-9" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="noscroll flex gap-2 overflow-x-auto">
        {['', ...TYPES].map((k) => <button key={k} onClick={() => setType(k)} className={`chip ${type === k ? 'on' : ''}`}>{t(k || 'all')}</button>)}
      </div>
      <div className="noscroll flex gap-2 overflow-x-auto">
        <button onClick={() => setCat('')} className={`chip ${cat === '' ? 'on' : ''}`}>{t('all_categories')}</button>
        {cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`chip ${cat === c.id ? 'on' : ''}`}>{c['name_' + lang] || c.name_en}</button>)}
      </div>

      {items === null && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 w-full" />)}</div>}
      {items && !items.length && <Card><Empty icon="bag">{t('empty_market')}</Empty></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items?.map((i, n) => {
          const media = [...(i.listing_media || [])].sort((a, b) => a.position - b.position)
          const mine = i.seller_id === user.id
          return (
            <Card key={i.id} hud flat i={Math.min(n, 8)} className={`lift flex flex-col ${i.status === 'sold' ? 'opacity-60' : ''}`}>
              <div className="relative h-44 bg-panel2">
                {media[0] ? <img loading="lazy" src={media[0].url} alt="" className="zoomable h-full w-full object-cover" onClick={() => zoom(media[0].url)} />
                  : <div className="grid h-full place-items-center text-muted"><Icon name="bag" size={36} /></div>}
                <span className={`tag ${TYPE_TAG[i.type]} absolute left-3 top-3 backdrop-blur`}>{t(i.type)}</span>
                {i.status !== 'available' && <span className="tag amber absolute right-3 top-3">{t('status_' + i.status)}</span>}
                {media.length > 1 && <span className="tag absolute bottom-2 right-3 backdrop-blur"><Icon name="image" size={12} />{media.length}</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-xl font-bold leading-tight">{i.title}</h3>
                  {i.price != null && <span className="flex-none rounded-lg bg-accent/15 px-2 py-0.5 font-display text-lg font-bold text-accent">{Number(i.price)} <span className="text-xs">{i.currency}</span></span>}
                </div>
                {i.description && <p className="line-clamp-3 text-sm text-muted">{i.description}</p>}
                {i.server && <p className="text-xs text-muted"><Icon name="globe" size={12} className="mr-1 inline" />{i.server}</p>}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <button onClick={() => go(profilePath(i.seller?.username))}><Avatar p={i.seller} size={30} /></button>
                  <div className="min-w-0 flex-1 text-xs"><button className="block max-w-full truncate font-semibold hover:text-accent" onClick={() => go(profilePath(i.seller?.username))}>{nameOf(i.seller)}</button><span className="text-muted">{timeAgo(i.created_at, lang)}</span></div>
                  {!mine && <button className="text-xs text-accent hover:underline" onClick={() => setReviews(i.seller)}>{t('seller_reviews')}</button>}
                </div>
                {mine ? (
                  <div className="flex gap-2">
                    {i.status === 'available' && <Button variant="soft" size="sm" className="flex-1" icon="check" onClick={() => sold(i.id)}>{t('sold')}</Button>}
                    <Button variant="danger" size="sm" icon="trash" onClick={() => del(i.id)}>{t('delete')}</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button className="flex-1" icon="chat" disabled={i.status !== 'available'} onClick={() => go(chatPath(i.seller?.username))}>{t('contact')}</Button>
                    <ReportButton type="listing" id={i.id} label="" className="round-btn !text-muted hover:!text-danger" />
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {creating && <NewListing cats={cats} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load() }} />}
      {reviews && <Modal wide title={`${t('seller_reviews')} · ${nameOf(reviews)}`} onClose={() => setReviews(null)}><SellerReviews sellerId={reviews.id} /></Modal>}
    </div>
  )
}

function NewListing({ cats, onClose, onDone }) {
  const { user } = useAuth(); const { t, lang } = useT(); const toast = useToast()
  const [f, setF] = useState({ title: '', description: '', price: '', type: 'sale', category_id: '', server: '' })
  const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const create = async () => {
    if (f.title.trim().length < 3) return toast(t('err_title'), 'error')
    setBusy(true)
    try {
      const { data, error } = await supabase.from('listings').insert({
        ...f, title: f.title.trim(), price: f.price === '' ? null : Number(f.price), category_id: f.category_id || null, seller_id: user.id,
      }).select().single()
      if (error) throw error
      for (const [i, file] of files.slice(0, 5).entries()) {
        const { error: e2 } = await supabase.from('listing_media').insert({ listing_id: data.id, url: await uploadImage(user.id, file, 1400), position: i })
        if (e2) throw e2
      }
      toast(t('listing_posted'), 'ok'); onDone()
    } catch (e) { toast(errText(e, t), 'error') }
    setBusy(false)
  }
  return (
    <Modal wide title={t('new_listing')} onClose={onClose}>
      <div className="space-y-3">
        <input className="input" maxLength={100} placeholder={t('title')} value={f.title} onChange={set('title')} />
        <textarea className="input" rows={3} placeholder={t('desc')} value={f.description} onChange={set('description')} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={f.type} onChange={set('type')}>{TYPES.map((k) => <option key={k} value={k}>{t(k)}</option>)}</select>
          <select className="input" value={f.category_id} onChange={set('category_id')}><option value="">{t('category')}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c['name_' + lang] || c.name_en}</option>)}</select>
          <input className="input" type="number" min="0" placeholder={t('price')} value={f.price} onChange={set('price')} />
          <input className="input" placeholder={t('server')} value={f.server} onChange={set('server')} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilePick multiple onPick={(fs) => setFiles(fs.slice(0, 5))}><span className="btn btn-soft btn-sm"><Icon name="image" size={16} />{t('add_photos')}</span></FilePick>
          <span className="text-xs text-muted">{files.length ? t('n_photos', { n: files.length }) : t('up_to_5')}</span>
        </div>
        <Button className="w-full" busy={busy} onClick={create}>{t('publish')}</Button>
      </div>
    </Modal>
  )
}
