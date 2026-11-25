import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath } from '../lib/router.js'
import { fetchRelations, friendAction, toggleFollow } from '../lib/social.js'
import { clean, errText, nameOf } from '../lib/util.js'
import { Avatar, Button, Card, Empty, Skeleton } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'

const FIELDS = 'id,username,user_code,display_name,bio,avatar_url,banner_url,server,game_nick'

// Find other survivors by username or NEXUS ID. Shows newest members when the box is empty.
export default function People({ initial = '' }) {
  const { user } = useAuth(); const { t } = useT(); const toast = useToast()
  const [q, setQ] = useState(initial); const [people, setPeople] = useState(null); const [rel, setRel] = useState({}); const [busy, setBusy] = useState('')

  useEffect(() => {
    let alive = true
    const id = setTimeout(async () => {
      const term = clean(q.trim())
      let r = supabase.from('profiles').select(FIELDS).neq('id', user.id).order('created_at', { ascending: false }).limit(30)
      if (term) r = r.or(`username.ilike.%${term}%,user_code.ilike.%${term}%,display_name.ilike.%${term}%`)
      const { data } = await r
      if (!alive) return
      setPeople(data || [])
      setRel(await fetchRelations(user.id, (data || []).map((p) => p.id)))
    }, 250)
    return () => { alive = false; clearTimeout(id) }
  }, [q, user.id])

  const refresh = async (id) => { const r = await fetchRelations(user.id, [id]); setRel((x) => ({ ...x, [id]: r[id] })) }
  const friend = async (p) => { setBusy(p.id); const { error } = await friendAction(user.id, p.id, rel[p.id]); if (error) toast(errText(error, t), 'error'); await refresh(p.id); setBusy('') }
  const follow = async (p) => { setBusy(p.id); const { error } = await toggleFollow(user.id, p.id, rel[p.id]); if (error) toast(errText(error, t), 'error'); await refresh(p.id); setBusy('') }

  const label = (r) => r?.friend ? t('friends_status') : r?.request === 'sent' ? t('cancel_request') : r?.request === 'received' ? t('accept') : t('add_friend')

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div><h1 className="font-display text-3xl font-bold">{t('people')}</h1><p className="text-sm text-muted">{t('people_sub')}</p></div>
      <div className="relative"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input !pl-9" autoFocus={!initial} value={q} onChange={(e) => setQ(e.target.value)} placeholder="username / USR-XXXXXX" /></div>
      {!q.trim() && <p className="text-xs font-semibold uppercase tracking-widest text-mist">{t('new_survivors')}</p>}
      {people === null && <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}</div>}
      {people && !people.length && <Card><Empty icon="search">{t('nothing_found')}</Empty></Card>}
      <div className="grid gap-4 sm:grid-cols-2">
        {people?.map((p, i) => {
          const r = rel[p.id]
          return (
            <Card key={p.id} hud flat i={Math.min(i, 8)} className="lift">
              <button className="cover !h-20 w-full" onClick={() => go(profilePath(p.username))} aria-label={nameOf(p)}>{p.banner_url && <img src={p.banner_url} alt="" loading="lazy" />}</button>
              <div className="space-y-3 p-4 pt-0">
                <div className="-mt-8 flex items-end gap-3">
                  <button className="relative z-[1]" onClick={() => go(profilePath(p.username))}><Avatar p={p} size={64} ring /></button>
                  <div className="min-w-0 pb-1"><button className="block max-w-full truncate font-semibold hover:text-accent" onClick={() => go(profilePath(p.username))}>{nameOf(p)}</button><p className="truncate text-xs text-muted">@{p.username} · {p.user_code}</p></div>
                </div>
                <p className="truncate text-xs text-muted">{[p.game_nick, p.server].filter(Boolean).join(' · ') || t('lifeafter_player')}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" variant={r?.friend ? 'soft' : 'primary'} icon={r?.friend ? 'userCheck' : 'userPlus'} busy={busy === p.id} onClick={() => friend(p)}>{label(r)}</Button>
                  <Button size="sm" variant="ghost" onClick={() => follow(p)} disabled={busy === p.id}>{r?.following ? t('unfollow') : t('follow')}</Button>
                  <Button size="sm" variant="soft" onClick={() => go(chatPath(p.username))} aria-label={t('message')}><Icon name="chat" size={16} /></Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
