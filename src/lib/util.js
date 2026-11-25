import { supabase } from './supabase.js'

/* ───── Username-only login ─────
   Supabase Auth needs an email, so each username is mapped to a private
   placeholder address. No email is ever sent (Confirm email must be OFF). */
export const LOGIN_DOMAIN = import.meta.env.VITE_LOGIN_DOMAIN || 'nexusplayers.com'
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/
export const cleanUsername = (s) => String(s || '').trim().toLowerCase().replace(/^@/, '')
export const toEmail = (username) => `${cleanUsername(username)}@${LOGIN_DOMAIN}`

/* ───── Images ───── */
export const MAX_BYTES = 5 * 1024 * 1024
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Shrinks big phone photos so they fit the upload limit. GIFs are kept as-is (to stay animated).
export async function prepareImage(file, maxDim = 1600) {
  if (!OK_TYPES.includes(file.type)) throw new Error('IMG_TYPE')
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('IMG_BIG')
    return file
  }
  let bmp
  try { bmp = await createImageBitmap(file) } catch { bmp = null }
  if (!bmp) {
    if (file.size > MAX_BYTES) throw new Error('IMG_BIG')
    return file
  }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) { bmp.close?.(); return file }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86))
  if (!blob) { if (file.size > MAX_BYTES) throw new Error('IMG_BIG'); return file }
  if (blob.size > MAX_BYTES) throw new Error('IMG_BIG')
  return new File([blob], 'photo.webp', { type: 'image/webp' })
}

export async function uploadImage(uid, file, maxDim = 1600) {
  const f = await prepareImage(file, maxDim)
  const ext = { 'image/gif': 'gif', 'image/png': 'png', 'image/webp': 'webp' }[f.type] || 'jpg'
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

// Turns a thrown error into text for the current language.
export function errText(e, t) {
  const m = e?.message || String(e || '')
  if (m === 'IMG_TYPE') return t('err_img_type')
  if (m === 'IMG_BIG') return t('err_img_big')
  if (/row-level security|violates row-level/i.test(m)) return t('err_denied')
  if (/Failed to fetch|NetworkError/i.test(m)) return t('err_network')
  return m
}

/* ───── Time ───── */
export function timeAgo(date, lang = 'en') {
  const d = new Date(date)
  const s = (Date.now() - d.getTime()) / 1000
  const loc = lang === 'zh' ? 'zh-CN' : lang
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto', style: 'narrow' })
  if (s < 45) return rtf.format(0, 'second')
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour')
  if (s < 7 * 86400) return rtf.format(-Math.round(s / 86400), 'day')
  return d.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
}
export const clock = (date, lang = 'en') => new Date(date).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : lang, { hour: '2-digit', minute: '2-digit' })
export const dayLabel = (date, lang = 'en') => new Date(date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang, { weekday: 'short', month: 'short', day: 'numeric' })
export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
export const clean = (s) => String(s || '').replace(/[,%()]/g, '')
export const nameOf = (p) => p?.display_name || p?.username || '?'
