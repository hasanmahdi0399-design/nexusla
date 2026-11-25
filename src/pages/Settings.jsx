import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, useToast } from '../lib/ctx.jsx'
import { useT, LANGS } from '../i18n/index.jsx'
import { go } from '../lib/router.js'
import { errText, nameOf, toEmail } from '../lib/util.js'
import { Avatar, Button, Card } from '../components/ui.jsx'

export default function Settings() {
  const { user, me, refreshMe } = useAuth(); const { t, lang, setLang } = useT(); const toast = useToast()
  const [vis, setVis] = useState(me?.profile_visibility || 'public'); const [busy, setBusy] = useState('')
  const [pw, setPw] = useState({ cur: '', next: '', again: '' }); const [blocked, setBlocked] = useState(null)

  const loadBlocked = async () => {
    const { data } = await supabase.from('blocks').select('blocked_id,profiles:profiles!blocks_blocked_id_fkey(id,username,display_name,avatar_url)').eq('blocker_id', user.id)
    setBlocked((data || []).filter((b) => b.profiles))
  }
  useEffect(() => { loadBlocked() }, [])

  const saveVis = async () => {
    setBusy('vis')
    const { error } = await supabase.from('profiles').update({ profile_visibility: vis }).eq('id', user.id)
    setBusy(''); if (error) toast(errText(error, t), 'error'); else { toast(t('saved'), 'ok'); refreshMe() }
  }
  const changePw = async () => {
    if (pw.next.length < 6) return toast(t('err_password_short'), 'error')
    if (pw.next !== pw.again) return toast(t('err_password_match'), 'error')
    setBusy('pw')
    // re-check the current password first
    const chk = await supabase.auth.signInWithPassword({ email: toEmail(me.username), password: pw.cur })
    if (chk.error) { setBusy(''); return toast(t('err_cur_password'), 'error') }
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    setBusy('')
    if (error) toast(errText(error, t), 'error'); else { toast(t('password_changed'), 'ok'); setPw({ cur: '', next: '', again: '' }) }
  }
  const unblock = async (id) => { await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id); loadBlocked() }
  const del = async () => {
    if (!confirm(t('confirm_delete_1')) || !confirm(t('confirm_delete_2'))) return
    setBusy('del')
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
    if (error) { setBusy(''); return toast(t('delete_failed') + ' ' + error.message, 'error') }
    await supabase.auth.signOut(); go('home'); location.reload()
  }
  const f = (k) => (e) => setPw({ ...pw, [k]: e.target.value })

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-3xl font-bold">{t('settings')}</h1>
      <Card hud i={0} className="space-y-2"><h2 className="font-display text-xl font-bold">{t('account')}</h2>
        <p className="text-sm text-muted">{t('signed_in_as')} <b className="text-accent">@{me?.username}</b> · {me?.user_code}</p>
        <div className="flex items-center gap-2"><span className="text-sm text-muted">{t('language')}</span>
          <select className="input !w-auto" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </Card>

      <Card hud i={1} className="space-y-3"><h2 className="font-display text-xl font-bold">{t('profile_visibility')}</h2>
        <p className="text-sm text-muted">{t('visibility_help')}</p>
        <select className="input" value={vis} onChange={(e) => setVis(e.target.value)}><option value="public">{t('public')}</option><option value="private">{t('private')}</option></select>
        <Button busy={busy === 'vis'} onClick={saveVis}>{t('save')}</Button></Card>

      <Card hud i={2} className="space-y-3"><h2 className="font-display text-xl font-bold">{t('change_password')}</h2>
        <input className="input" type="password" autoComplete="current-password" placeholder={t('current_password')} value={pw.cur} onChange={f('cur')} />
        <input className="input" type="password" autoComplete="new-password" placeholder={t('new_password')} value={pw.next} onChange={f('next')} />
        <input className="input" type="password" autoComplete="new-password" placeholder={t('confirm_password')} value={pw.again} onChange={f('again')} />
        <Button busy={busy === 'pw'} onClick={changePw}>{t('update_password')}</Button>
        <p className="text-xs text-muted">{t('no_recovery')}</p></Card>

      <Card hud i={3} className="space-y-2"><h2 className="font-display text-xl font-bold">{t('blocked_users')}</h2>
        {blocked?.map((b) => <div key={b.blocked_id} className="flex items-center gap-3"><Avatar p={b.profiles} size={36} /><span className="flex-1 truncate">{nameOf(b.profiles)}</span><Button size="sm" variant="ghost" onClick={() => unblock(b.blocked_id)}>{t('unblock')}</Button></div>)}
        {blocked && !blocked.length && <p className="text-sm text-muted">{t('no_blocked')}</p>}</Card>

      <Card hud i={4} className="space-y-3 !border-danger/30"><h2 className="font-display text-xl font-bold text-danger">{t('delete_account')}</h2>
        <p className="text-sm text-muted">{t('delete_help')}</p>
        <Button variant="danger" busy={busy === 'del'} onClick={del}>{t('delete_account_btn')}</Button></Card>
    </div>
  )
}
