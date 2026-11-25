import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath } from '../lib/router.js'
import { loadFriends, PROFILE_FIELDS } from '../lib/social.js'
import { errText, nameOf } from '../lib/util.js'
import { Avatar, Button, Card, Empty, Skeleton } from '../components/ui.jsx'

export default function Friends() {
  const { user } = useAuth(); const { t } = useT(); const toast = useToast()
  const [reqs, setReqs] = useState(null); const [sent, setSent] = useState([]); const [friends, setFriends] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('friend_requests')
      .select(`id,requester_id,recipient_id,requester:profiles!friend_requests_requester_id_fkey(${PROFILE_FIELDS}),recipient:profiles!friend_requests_recipient_id_fkey(${PROFILE_FIELDS})`)
      .eq('status', 'pending').or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(60)
    setReqs((data || []).filter((x) => x.recipient_id === user.id && x.requester))
    setSent((data || []).filter((x) => x.requester_id === user.id && x.recipient))
    setFriends(await loadFriends(user.id, 200))
  }, [user.id])
  useEffect(() => { load() }, [load])

  const act = async (id, status) => {
    const { error } = await supabase.from('friend_requests').update({ status }).eq('id', id)
    if (error) toast(errText(error, t), 'error'); load()
  }
  const unfriend = async (id) => {
    if (!confirm(t('confirm_unfriend'))) return
    const { error } = await supabase.from('friend_requests').delete().eq('id', id)
    if (error) toast(errText(error, t), 'error'); load()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold">{t('friends')}</h1>

      {reqs?.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold">{t('requests')} <span className="tag amber ml-1">{reqs.length}</span></h2>
          {reqs.map((r, i) => (
            <Card key={r.id} i={i} hud className="flex flex-wrap items-center gap-3">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go(profilePath(r.requester.username))}>
                <Avatar p={r.requester} size={52} /><span className="min-w-0"><b className="block truncate">{nameOf(r.requester)}</b><span className="text-xs text-muted">@{r.requester.username}</span></span>
              </button>
              <div className="flex gap-2"><Button size="sm" onClick={() => act(r.id, 'accepted')}>{t('accept')}</Button><Button size="sm" variant="ghost" onClick={() => act(r.id, 'declined')}>{t('decline')}</Button></div>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-xl font-bold">{t('your_friends')}{friends ? ` · ${friends.length}` : ''}</h2>
        {friends === null && <Skeleton className="h-20 w-full" />}
        {friends && !friends.length && <Card><Empty icon="users">{t('no_friends_yet')}<br /><button className="link" onClick={() => go('people')}>{t('find_survivors')}</button></Empty></Card>}
        <div className="grid gap-3 sm:grid-cols-2">
          {friends?.map(({ requestId, profile: p }, i) => (
            <Card key={requestId} i={Math.min(i, 8)} className="lift flex items-center gap-3 !p-3">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go(profilePath(p.username))}>
                <Avatar p={p} size={52} /><span className="min-w-0"><b className="block truncate">{nameOf(p)}</b><span className="text-xs text-muted">@{p.username}</span></span>
              </button>
              <Button size="sm" variant="soft" icon="chat" onClick={() => go(chatPath(p.username))} aria-label={t('message')} />
              <Button size="sm" variant="ghost" onClick={() => unfriend(requestId)}>{t('unfriend')}</Button>
            </Card>
          ))}
        </div>
      </section>

      {sent.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold">{t('sent_requests')}</h2>
          {sent.map((r) => (
            <Card key={r.id} className="flex items-center gap-3 !p-3">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go(profilePath(r.recipient.username))}><Avatar p={r.recipient} size={44} /><b className="truncate">{nameOf(r.recipient)}</b></button>
              <Button size="sm" variant="ghost" onClick={() => act(r.id, 'cancelled')}>{t('cancel_request')}</Button>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
