'use client'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('hook-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])
  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('hook-theme', next ? 'dark' : 'light')
  }
  return (
    <button
      onClick={toggle}
      className="size-8 rounded-full border border-border hover:bg-secondary transition-colors flex items-center justify-center text-sm"
      aria-label="Toggle theme"
    >
      {dark ? '☾' : '☀'}
    </button>
  )
}
