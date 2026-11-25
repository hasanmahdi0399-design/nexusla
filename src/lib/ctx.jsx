import { createContext, useCallback, useContext, useState } from 'react'

// Who is signed in: { user (auth user), me (profile row), refreshMe() }
export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const push = useCallback((msg, kind = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setList((l) => [...l.slice(-2), { id, msg, kind }])
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {list.map((x) => <div key={x.id} className={`toast toast-${x.kind}`}>{x.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
