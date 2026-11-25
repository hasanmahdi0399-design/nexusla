import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { USERNAME_RE, cleanUsername, toEmail } from '../lib/util.js'
import { useT, LANGS } from '../i18n/index.jsx'
import { Button, Hazard } from '../components/ui.jsx'
import { Icon, Logo } from '../components/Icon.jsx'

// Username + password only. No email anywhere.
export default function Auth({ onLegal }) {
  const { t, lang, setLang } = useT()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ username: '', password: '', confirm: '', display: '' })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [show, setShow] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const signup = mode === 'signup'

  const go = async (e) => {
    e.preventDefault(); setMsg('')
    const username = cleanUsername(f.username)
    if (!USERNAME_RE.test(username)) return setMsg(t('err_username'))
    if (f.password.length < 6) return setMsg(t('err_password_short'))
    if (signup && f.password !== f.confirm) return setMsg(t('err_password_match'))
    setBusy(true)
    try {
      if (!signup) {
        const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password: f.password })
        if (error) setMsg(/invalid login/i.test(error.message) ? t('err_login') : error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: toEmail(username), password: f.password,
          options: { data: { username, display_name: f.display.trim() || username } },
        })
        if (error) setMsg(/already registered|already exists/i.test(error.message) ? t('err_taken') : error.message)
        else if (!data.session) setMsg(t('err_confirm_on')) // Supabase "Confirm email" is still ON
      }
    } catch (err) { setMsg(err.message) }
    setBusy(false)
  }

  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-5xl items-center gap-8 px-4 py-8 md:grid-cols-2">
      <div className="page space-y-5 text-center md:text-left">
        <Logo size={44} className="justify-center md:justify-start" />
        <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">{t('hero_1')}<br /><span className="text-accent glow-text">{t('hero_2')}</span></h1>
        <p className="mx-auto max-w-md text-muted md:mx-0">{t('hero_sub')}</p>
        <Hazard className="mx-auto max-w-xs md:mx-0" />
        <p className="font-display text-lg font-semibold tracking-[0.25em] text-mist">BUY. SELL. TRADE. CONNECT.</p>
        <ul className="mx-auto hidden max-w-md gap-2 text-sm text-muted md:grid">
          {['feat_1', 'feat_2', 'feat_3'].map((k, i) => (
            <li key={k} className="rise flex items-center gap-2" style={{ '--i': i + 3 }}><Icon name="check" size={16} className="text-toxic" />{t(k)}</li>
          ))}
        </ul>
      </div>

      <form onSubmit={go} className="card hud auth-card mx-auto w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{t(mode)}</h2>
          <select className="rounded-lg bg-panel2 px-2 py-1 text-sm" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            {LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('username')}</span>
          <input className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" maxLength={24} value={f.username} onChange={set('username')} placeholder="survivor_01" />
        </label>
        {signup && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('display_name')} <span className="normal-case opacity-60">({t('optional')})</span></span>
            <input className="input" maxLength={40} value={f.display} onChange={set('display')} />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('password')}</span>
          <div className="relative">
            <input className="input !pr-11" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={f.password} onChange={set('password')} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted hover:text-accent" onClick={() => setShow(!show)}>{show ? t('hide') : t('show')}</button>
          </div>
        </label>
        {signup && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('confirm_password')}</span>
            <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />
          </label>
        )}
        {msg && <p className="fade rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{msg}</p>}
        <Button type="submit" className="w-full" busy={busy}>{t(mode)}</Button>
        {signup && <p className="text-xs text-muted">{t('no_recovery')}</p>}
        <button type="button" className="w-full text-sm text-accent hover:underline" onClick={() => { setMode(signup ? 'login' : 'signup'); setMsg('') }}>
          {signup ? t('have_account') : t('need_account')}
        </button>
        <button type="button" className="w-full text-xs text-muted hover:text-ink" onClick={onLegal}>{t('legal')}</button>
      </form>
    </div>
  )
}
