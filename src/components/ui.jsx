import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.jsx'

export function Card({ children, className = '', hud = false, flat = false, i, style, ...props }) {
  return (
    <section
      className={`card ${hud ? 'hud' : ''} ${flat ? 'card-flat' : ''} ${i != null ? 'rise' : ''} ${className}`}
      style={i != null ? { '--i': i, ...style } : style}
      {...props}
    >
      {children}
    </section>
  )
}

const V = { primary: 'btn-primary', ghost: 'btn-ghost', soft: 'btn-soft', danger: 'btn-danger' }
export function Button({ children, className = '', variant = 'primary', size, icon, type = 'button', busy, ...props }) {
  return (
    <button type={type} className={`btn ${V[variant] || V.primary} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={busy || props.disabled} {...props}>
      {busy ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children}
    </button>
  )
}

export function Avatar({ p, size = 40, ring = false, className = '' }) {
  const seed = p?.username || '?'
  const hue = useMemo(() => [...seed].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360, [seed])
  const name = p?.display_name || p?.username || '?'
  return (
    <span
      className={`avatar ${ring ? 'avatar-ring' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.44, '--abg': `hsl(${hue} 32% 20%)`, '--afg': `hsl(${hue} 65% 72%)` }}
    >
      {p?.avatar_url ? <img src={p.avatar_url} alt="" loading="lazy" draggable="false" /> : String(name).trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export const Spinner = ({ className = '' }) => <span className={`spinner ${className}`} role="status" />
export const Skeleton = ({ className = '', style }) => <div className={`skeleton ${className}`} style={style} />
export const Hazard = ({ className = '' }) => <div className={`hazard ${className}`} />

export function Empty({ icon = 'tent', children }) {
  return <div className="empty"><Icon name={icon} size={40} /><p className="max-w-xs text-sm">{children}</p></div>
}

export function PostSkeleton() {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 !rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/5" /></div></div>
      <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-40 w-full" />
    </Card>
  )
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={wide ? { maxWidth: 640 } : undefined} role="dialog" aria-modal="true">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <button className="round-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Tap any image to see it big.
const LightboxCtx = createContext(() => {})
export const useLightbox = () => useContext(LightboxCtx)
export function LightboxProvider({ children }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!src) return
    const k = (e) => e.key === 'Escape' && setSrc(null)
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [src])
  return (
    <LightboxCtx.Provider value={setSrc}>
      {children}
      {src && createPortal(
        <div className="scrim" style={{ zIndex: 150, padding: 8 }} onClick={() => setSrc(null)}>
          <img src={src} alt="" style={{ maxHeight: '92vh', maxWidth: '96vw', objectFit: 'contain', borderRadius: 12, animation: 'modalin .3s ease' }} />
          <button className="round-btn" style={{ position: 'fixed', top: 14, right: 14 }} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>,
        document.body,
      )}
    </LightboxCtx.Provider>
  )
}

// Fog, drifting spores and scanlines behind everything.
export function Atmosphere() {
  const spores = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    x: `${(i * 6.4 + Math.random() * 5).toFixed(1)}%`,
    s: `${(2 + Math.random() * 3).toFixed(1)}px`,
    d: `${(14 + Math.random() * 18).toFixed(1)}s`,
    dl: `-${(Math.random() * 24).toFixed(1)}s`,
    dx: `${(Math.random() * 120 - 60).toFixed(0)}px`,
    g: i % 4 === 0,
  })), [])
  return (
    <div className="atmos" aria-hidden="true">
      <div className="fog" /><div className="fog f2" /><div className="fog f3" />
      {spores.map((s, i) => <i key={i} className={`spore ${s.g ? 'g' : ''}`} style={{ '--x': s.x, '--s': s.s, '--d': s.d, '--dl': s.dl, '--dx': s.dx }} />)}
    </div>
  )
}

// Hidden file input wrapped as a button.
export function FilePick({ accept = 'image/*', onPick, children, className = '', multiple = false }) {
  return (
    <label className={`cursor-pointer ${className}`}>
      {children}
      <input type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => { const f = multiple ? [...e.target.files] : e.target.files?.[0]; e.target.value = ''; if (f && (!multiple || f.length)) onPick(f) }} />
    </label>
  )
}
