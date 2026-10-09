import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'raffle.theme'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * Admin theme: follows prefers-color-scheme until the admin toggles it, then the choice is
 * stored in localStorage and applied as `data-theme` on <html> (tokens.css reads it).
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [stored, setStored] = useState<Theme | null>(readStored)
  const theme = stored ?? systemTheme()

  useEffect(() => {
    if (stored) document.documentElement.dataset.theme = stored
  }, [stored])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }
    setStored(next)
  }, [theme])

  return { theme, toggle }
}
