export const THEME_KEY = 'intertangle:theme'

export function readTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(t: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = t
  localStorage.setItem(THEME_KEY, t)
}
