import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// index.html applies this same key before first paint, so the choice covers the public page too.
export const THEME_STORAGE_KEY = 'raffle.theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function writeStored(theme: Theme | null) {
  try {
    if (theme) localStorage.setItem(THEME_STORAGE_KEY, theme)
    else localStorage.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
}

function darkQuery(): MediaQueryList | null {
  try {
    return window.matchMedia(DARK_QUERY)
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (darkQuery()?.matches ? 'dark' : 'light')

/**
 * Site theme: follows the device (prefers-color-scheme, live) until the admin toggles it away
 * from the device setting; that override is stored in localStorage and applied as `data-theme`
 * on <html> (tokens.css reads it). Toggling back to match the device clears the override.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [stored, setStored] = useState<Theme | null>(readStored)
  const [system, setSystem] = useState<Theme>(systemTheme)
  const theme = stored ?? system

  useEffect(() => {
    const mq = darkQuery()
    if (!mq) return
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (stored) root.dataset.theme = stored
    else root.removeAttribute('data-theme')
  }, [stored])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const override = next === system ? null : next
    writeStored(override)
    setStored(override)
  }, [theme, system])

  return { theme, toggle }
}
