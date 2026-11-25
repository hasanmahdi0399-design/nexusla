import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { errText, nameOf, timeAgo } from '../lib/util.js'
import { Avatar, Button, Empty } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'

const Stars = ({ n }) => <span className="text-accent">{'★'.repeat(n)}<span className="text-muted/40">{'★'.repeat(5 - n)}</span></span>

// Reviews are allowed only after you've exchanged DMs with the seller (enforced by the database).
export function SellerReviews({ sellerId }) {
  const { user } = useAuth(); const { t, lang } = useT(); const toast = useToast()
  const [rows, setRows] = useState(null); const [rating, setRating] = useState(5); const [body, setBody] = useState('')
  const load = async () => {
    const { data } = await supabase.from('seller_reviews').select('*, reviewer:profiles!seller_reviews_reviewer_id_fkey(username,display_name,avatar_url)').eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(30)
    setRows(data || [])
  }
  useEffect(() => { load() }, [sellerId])
  const submit = async () => {
    const { error } = await supabase.from('seller_reviews').insert({ seller_id: sellerId, reviewer_id: user.id, rating, body: body.trim() })
    if (error) return toast(/row-level|violates/i.test(error.message) ? t('review_need_dm') : /duplicate|unique/i.test(error.message) ? t('review_dup') : errText(error, t), 'error')
    setBody(''); toast(t('review_posted'), 'ok'); load()
  }
  const avg = rows?.length ? (rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(1) : null
  return (
    <div className="space-y-3">
      {avg && <p className="font-display text-2xl font-bold text-accent">{avg} <Icon name="star" size={18} className="inline fill-accent" /> <span className="text-sm font-normal text-muted">({rows.length})</span></p>}
      {sellerId !== user.id && (
        <div className="space-y-2 rounded-xl bg-panel2 p-3">
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} className={`text-2xl transition-transform hover:scale-125 ${n <= rating ? 'text-accent' : 'text-muted/40'}`}>★</button>)}</div>
          <textarea className="input" rows={2} maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('review_placeholder')} />
          <Button size="sm" onClick={submit}>{t('submit_review')}</Button>
        </div>
      )}
      {rows?.map((r) => (
        <div key={r.id} className="fade flex gap-3 rounded-xl bg-panel2 p-3">
          <Avatar p={r.reviewer} size={36} />
          <div className="min-w-0"><p className="text-sm"><b>{nameOf(r.reviewer)}</b> <span className="text-xs text-muted">{timeAgo(r.created_at, lang)}</span></p><Stars n={r.rating} />{r.body && <p className="mt-1 text-sm">{r.body}</p>}</div>
        </div>
      ))}
      {rows && !rows.length && <Empty icon="star">{t('no_reviews')}</Empty>}
    </div>
  )
}
