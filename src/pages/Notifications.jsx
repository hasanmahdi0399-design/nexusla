import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath, refreshCounts } from '../lib/router.js'
import { timeAgo } from '../lib/util.js'
import { Avatar, Button, Card, Empty, Skeleton } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'

const ICON = { reaction: 'heart', comment: 'chat', follow: 'user', message: 'chat', friend_request: 'userPlus', friend_accepted: 'userCheck', listing_inquiry: 'bag', system: 'megaphone' }
const WHERE = (n) => {
  const who = n.data?.who
  if (n.kind === 'message' && who) return chatPath(who)
  if (n.kind === 'friend_request') return 'friends'
  if ((n.kind === 'follow' || n.kind === 'friend_accepted') && who) return profilePath(who)
  return 'home'
}

export default function Notifications() {
  const { user } = useAuth(); const { t, lang } = useT()
  const [list, setList] = useState(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(id,username,display_name,avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60)
    setList(data || [])
  }, [user.id])
  useEffect(() => {
    load()
    const ch = supabase.channel('notif-page-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load).subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  const markAll = async () => { await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false); await load(); refreshCounts() }
  const open = async (n) => {
    if (!n.read) { await supabase.from('notifications').update({ read: true }).eq('id', n.id); refreshCounts() }
    go(WHERE(n))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl font-bold">{t('notifications')}</h1>
        {list?.some((n) => !n.read) && <Button size="sm" variant="ghost" icon="check" onClick={markAll}>{t('markAll')}</Button>}</div>
      {list === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      {list?.map((n, i) => (
        <button key={n.id} onClick={() => open(n)} className={`card lift rise flex w-full items-center gap-3 !p-3 text-left ${n.read ? 'opacity-70' : '!border-accent/40'}`} style={{ '--i': Math.min(i, 8) }}>
          <span className="relative"><Avatar p={n.actor || { username: n.data?.who }} size={46} />
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[#1a1205] ring-2 ring-panel"><Icon name={ICON[n.kind] || 'bell'} size={11} /></span></span>
          <span className="min-w-0 flex-1 text-sm"><b>{n.actor?.display_name || n.data?.who || t('system')}</b> {t('n_' + n.kind)}<span className="block text-xs text-muted">{timeAgo(n.created_at, lang)}</span></span>
          {!n.read && <span className="h-2.5 w-2.5 flex-none rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />}
        </button>
      ))}
      {list && !list.length && <Card><Empty icon="bell">{t('empty_notifications')}</Empty></Card>}
    </div>
  )
}
