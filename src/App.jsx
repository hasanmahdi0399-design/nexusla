import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, supabaseReady } from './lib/supabase.js'
import { AuthCtx } from './lib/ctx.jsx'
import { useT, LANGS } from './i18n/index.jsx'
import { go, profilePath, useRoute } from './lib/router.js'
import { Atmosphere, Avatar, Spinner } from './components/ui.jsx'
import { Icon, Logo } from './components/Icon.jsx'
import Auth from './pages/Auth.jsx'
import Home from './pages/Home.jsx'
import Market from './pages/Market.jsx'
import People from './pages/People.jsx'
import Friends from './pages/Friends.jsx'
import Messages from './pages/Messages.jsx'
import Notifications from './pages/Notifications.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Admin from './pages/Admin.jsx'
import Legal from './pages/Legal.jsx'

const NAV = [['home', 'home'], ['market', 'bag'], ['people', 'search'], ['friends', 'users']]

function Setup() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card hud max-w-md space-y-3 text-center">
        <Logo className="justify-center" />
        <p className="text-muted">Set <b className="text-accent">VITE_SUPABASE_URL</b> and <b className="text-accent">VITE_SUPABASE_ANON_KEY</b> in Cloudflare Pages (or <code>.env.local</code>), then redeploy.</p>
      </div>
    </div>
  )
}

export default function App() {
  const { t, lang, setLang } = useT()
  const { page, param } = useRoute()
  const [user, setUser] = useState(null); const [ready, setReady] = useState(!supabaseReady)
  const [me, setMe] = useState(null); const [counts, setCounts] = useState({ msgs: 0, notifs: 0 })
  const [menu, setMenu] = useState(false); const [q, setQ] = useState(''); const [searching, setSearching] = useState(false)
  const menuRef = useRef(null)

  /* session */
  useEffect(() => {
    if (!supabaseReady) return
    supabase.auth.getSession().then((r) => { setUser(r.data.session?.user ?? null); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  /* my profile */
  const refreshMe = useCallback(async () => {
    if (!user) return setMe(null)
    for (let k = 0; k < 3; k++) { // the profile row is created by a DB trigger; allow a moment on first sign-up
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (data) return setMe(data)
      await new Promise((r) => setTimeout(r, 600))
    }
  }, [user?.id])
  useEffect(() => { setMe(null); refreshMe() }, [refreshMe])

  /* unread badges + realtime */
  const loadCounts = useCallback(async () => {
    if (!user) return
    const [m, n] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).is('read_at', null),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
    ])
    setCounts({ msgs: m.count || 0, notifs: n.count || 0 })
  }, [user?.id])
  useEffect(() => {
    if (!user) return
    loadCounts()
    const ch = supabase.channel('shell-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, loadCounts)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadCounts)
      .subscribe()
    window.addEventListener('nx-counts', loadCounts)
    return () => { supabase.removeChannel(ch); window.removeEventListener('nx-counts', loadCounts) }
  }, [loadCounts])

  /* close menu on outside tap */
  useEffect(() => {
    if (!menu) return
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [menu])
  useEffect(() => { setMenu(false) }, [page, param])

  if (!supabaseReady) return <><Atmosphere /><div className="app"><Setup /></div></>
  if (!ready) return <><Atmosphere /><div className="app grid min-h-screen place-items-center"><Spinner /></div></>

  /* signed out */
  if (!user) {
    return (
      <>
        <Atmosphere />
        <div className="app">
          {page === 'legal'
            ? <div className="mx-auto max-w-2xl p-4"><button className="link mb-3 inline-flex items-center gap-1" onClick={() => go('home')}><Icon name="back" size={16} />{t('back')}</button><Legal /></div>
            : <Auth onLegal={() => go('legal')} />}
        </div>
      </>
    )
  }

  const staff = me && me.role !== 'user'
  const isActive = (k) => page === k || (k === 'home' && !['market', 'people', 'friends', 'messages', 'notifications', 'settings', 'admin', 'legal', 'u'].includes(page))
  const myPath = me ? profilePath(me.username) : 'home'
  const onMe = page === 'u' && me && param.toLowerCase() === me.username

  const submitSearch = (e) => { e.preventDefault(); go('people/' + encodeURIComponent(q.trim())); setSearching(false) }

  let view
  switch (page) {
    case 'market': view = <Market />; break
    case 'people': view = <People initial={param} key={param} />; break
    case 'friends': view = <Friends />; break
    case 'messages': view = <Messages param={param} />; break
    case 'notifications': view = <Notifications />; break
    case 'settings': view = <Settings />; break
    case 'admin': view = staff ? <Admin role={me.role} /> : <Home />; break
    case 'legal': view = <Legal />; break
    case 'u': view = <Profile username={param} key={param} />; break
    default: view = <Home />
  }
  const wide = page === 'messages'

  return (
    <AuthCtx.Provider value={{ user, me, refreshMe }}>
      <Atmosphere />
      <div className="app">
        {/* ───── top bar ───── */}
        <header className="topbar">
          {!searching && <button onClick={() => go('home')} aria-label="NEXUS"><Logo size={30} text={false} className="md:hidden" /><Logo size={30} className="hidden md:inline-flex" /></button>}
          <form onSubmit={submitSearch} className={`relative ${searching ? 'flex-1' : 'hidden'} md:block md:w-64`}>
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !rounded-full !py-2 !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_survivors')} autoFocus={searching} />
          </form>
          {searching && <button className="round-btn" onClick={() => setSearching(false)}><Icon name="x" size={18} /></button>}

          <nav className="mx-auto hidden items-center gap-1 md:flex">
            {NAV.map(([k, ic]) => <button key={k} title={t(k)} aria-label={t(k)} onClick={() => go(k)} className={`navbtn ${isActive(k) ? 'on' : ''}`}><Icon name={ic} size={24} /></button>)}
          </nav>

          <div className={`ml-auto flex items-center gap-2 ${searching ? 'hidden' : ''}`}>
            <button className="round-btn md:hidden" onClick={() => setSearching(true)} aria-label={t('search')}><Icon name="search" size={18} /></button>
            <button className="round-btn" onClick={() => go('messages')} aria-label={t('messages')}><Icon name="chat" size={19} />{counts.msgs > 0 && <span className="badge">{counts.msgs > 9 ? '9+' : counts.msgs}</span>}</button>
            <button className="round-btn" onClick={() => go('notifications')} aria-label={t('notifications')}><Icon name="bell" size={19} />{counts.notifs > 0 && <span className="badge">{counts.notifs > 9 ? '9+' : counts.notifs}</span>}</button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenu(!menu)} aria-label="Menu" className="rounded-full transition hover:ring-2 hover:ring-accent/60"><Avatar p={me} size={40} /></button>
              {menu && (
                <div className="menu">
                  <button onClick={() => go(myPath)} className="!py-3">
                    <Avatar p={me} size={36} /><span className="min-w-0"><b className="block truncate">{me?.display_name || me?.username}</b><span className="text-xs text-muted">@{me?.username}</span></span>
                  </button>
                  <hr className="divider !my-1" />
                  <button onClick={() => go('settings')}><Icon name="sliders" size={18} />{t('settings')}</button>
                  {staff && <button onClick={() => go('admin')}><Icon name="shield" size={18} />{t('admin')}</button>}
                  <button onClick={() => go('legal')}><Icon name="file" size={18} />{t('legal')}</button>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Icon name="globe" size={18} className="text-muted" />
                    <select className="flex-1 rounded-lg bg-panel px-2 py-1.5 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </div>
                  <hr className="divider !my-1" />
                  <button onClick={() => supabase.auth.signOut().then(() => { setMe(null); go('home') })}><Icon name="logout" size={18} />{t('logout')}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {me && me.status !== 'active' && <div className="bg-danger/15 px-4 py-2 text-center text-sm text-danger">{t('account_restricted')}</div>}

        {/* ───── page ───── */}
        <main className={`mx-auto w-full px-3 pb-28 pt-4 md:px-6 md:pb-10 ${wide ? 'max-w-6xl' : 'max-w-6xl'}`}>
          <div className="page" key={page + '/' + (page === 'messages' ? '' : param)}>{view}</div>
          <p className="mt-10 text-center text-xs text-muted">
            {t('disclaimer_short')} <button className="link" onClick={() => go('legal')}>{t('legal')}</button>
          </p>
        </main>

        {/* ───── mobile bottom nav ───── */}
        <nav className="bottomnav md:hidden">
          {NAV.map(([k, ic]) => <button key={k} onClick={() => go(k)} className={isActive(k) ? 'on' : ''} aria-label={t(k)}><Icon name={ic} size={24} /></button>)}
          <button onClick={() => go(myPath)} className={onMe ? 'on' : ''} aria-label={t('me')}><Avatar p={me} size={28} ring={onMe} /></button>
        </nav>
      </div>
    </AuthCtx.Provider>
  )
}
