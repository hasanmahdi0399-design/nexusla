import { useEffect, useState } from 'react'

// Tiny hash router so the phone's Back button works and profiles/chats have shareable links.
// #/home   #/market   #/people/<search>   #/u/<username>   #/messages/<username>
function read() {
  const h = location.hash.replace(/^#\/?/, '')
  const [page = 'home', ...rest] = h.split('/')
  let param = rest.join('/')
  try { param = decodeURIComponent(param) } catch { /* keep raw */ }
  return { page: page || 'home', param }
}

export function useRoute() {
  const [r, setR] = useState(read)
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export const go = (path) => { location.hash = '/' + path }
export const profilePath = (username) => `u/${encodeURIComponent(username)}`
export const chatPath = (username) => `messages/${encodeURIComponent(username)}`
export const refreshCounts = () => window.dispatchEvent(new Event('nx-counts'))
