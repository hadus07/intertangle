import { useState } from 'react'

const KEY = 'intertangle:theme'
type Theme = 'light' | 'dark'

// The pre-paint script in index.html sets data-theme before React mounts; this
// just reads/writes the same attribute + the global localStorage key.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  )
  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem(KEY, next)
    setTheme(next)
  }
  return { theme, toggle }
}
