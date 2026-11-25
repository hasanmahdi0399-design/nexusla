import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import en from './en.js'
import zh from './zh.js'
import id from './id.js'

const D = { en, zh, id }
export const LANGS = [['en', '🇬🇧 EN'], ['zh', '🇨🇳 中文'], ['id', '🇮🇩 ID']]
const I18n = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => { try { const s = localStorage.getItem('lang'); return D[s] ? s : 'en' } catch { return 'en' } })
  const setLang = (l) => {
    try { localStorage.setItem('lang', l) } catch { /* private mode */ }
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : l
    setLangState(l)
  }
  // t('key') or t('key', { name: 'x' }) fills {name}
  const t = useCallback((k, v) => {
    let s = D[lang][k] ?? D.en[k] ?? k
    if (v) for (const x of Object.keys(v)) s = s.split('{' + x + '}').join(v[x])
    return s
  }, [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])
  return <I18n.Provider value={value}>{children}</I18n.Provider>
}
export const useT = () => useContext(I18n)
