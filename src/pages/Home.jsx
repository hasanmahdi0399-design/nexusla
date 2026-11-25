import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/ctx.jsx'
import { useT } from '../i18n/index.jsx'
import { chatPath, go, profilePath } from '../lib/router.js'
import { loadFriends } from '../lib/social.js'
import { nameOf } from '../lib/util.js'
import { Avatar, Card, Hazard } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { PostFeed } from '../components/Post.jsx'
import Stories from '../components/Stories.jsx'
import { Announcement } from './Admin.jsx'

export default function Home() {
  const { me, user } = useAuth(); const { t } = useT()
  const [tab, setTab] = useState('all')
  const [contacts, setContacts] = useState(null)
  useEffect(() => { loadFriends(user.id, 12).then((r) => setContacts(r.map((x) => x.profile))) }, [user.id])

  const links = [
    ['u', 'user', t('my_profile'), profilePath(me?.username || '')],
    ['friends', 'users', t('friends'), 'friends'],
    ['messages', 'chat', t('messages'), 'messages'],
    ['market', 'bag', t('market'), 'market'],
    ['people', 'search', t('people'), 'people'],
    ['settings', 'sliders', t('settings'), 'settings'],
  ]

  return (
    <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_280px]">
      {/* left rail */}
      <aside className="hidden space-y-3 lg:block">
        <div className="sticky top-[72px] space-y-3">
          <Card hud i={0} className="space-y-1 !p-3">
            {links.map(([k, ic, label, path], i) => (
              <button key={k} className="sidelink" onClick={() => go(path)}>
                {k === 'u' ? <Avatar p={me} size={30} /> : <Icon name={ic} size={22} className="text-accent" />}
                <span className="truncate">{k === 'u' ? nameOf(me) : label}</span>
              </button>
            ))}
          </Card>
          <Hazard />
          <p className="px-1 text-xs text-muted">BUY. SELL. TRADE. CONNECT.</p>
        </div>
      </aside>

      {/* feed */}
      <section className="mx-auto w-full max-w-[640px] space-y-4">
        <Announcement />
        <Stories />
        <div className="flex gap-2">
          {['all', 'following'].map((k) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t('feed_' + k)}</button>)}
        </div>
        <PostFeed key={tab} composer followingOnly={tab === 'following'} empty={tab === 'following' ? t('empty_following') : undefined} />
      </section>

      {/* right rail: contacts */}
      <aside className="hidden lg:block">
        <div className="sticky top-[72px]">
          <Card hud i={1} className="space-y-2 !p-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-lg font-bold">{t('contacts')}</h3>
              <button className="text-xs text-accent hover:underline" onClick={() => go('friends')}>{t('see_all')}</button>
            </div>
            {contacts === null && <div className="skeleton h-10 w-full" />}
            {contacts?.map((p) => (
              <button key={p.id} className="sidelink !py-2" onClick={() => go(chatPath(p.username))}>
                <Avatar p={p} size={34} /><span className="truncate text-sm">{nameOf(p)}</span>
              </button>
            ))}
            {contacts && !contacts.length && <p className="px-2 py-3 text-sm text-muted">{t('no_friends_yet')}</p>}
          </Card>
        </div>
      </aside>
    </div>
  )
}
