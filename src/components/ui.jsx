import React from 'react'

export function Card({ children, className = '', ...props }) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-panel p-4 shadow-lg shadow-black/10 ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}) {
  const variants = {
    primary: 'bg-accent text-bg hover:brightness-105',
    ghost: 'border border-white/10 bg-transparent text-ink hover:border-accent/50 hover:text-accent',
    danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
  }

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
