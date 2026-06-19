import { useState } from 'react'

const hiddenKey = (root: string) => `intertangle:hidden:${root}`

export function useHidden(root: string) {
  const [chips, setChips] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem(hiddenKey(root)) ?? '[]'),
  )

  function addChip(pattern: string) {
    if (chips.includes(pattern)) return
    const next = [...chips, pattern]
    setChips(next)
    localStorage.setItem(hiddenKey(root), JSON.stringify(next))
  }

  function removeChip(pattern: string) {
    const next = chips.filter((p) => p !== pattern)
    setChips(next)
    localStorage.setItem(hiddenKey(root), JSON.stringify(next))
  }

  return { chips, addChip, removeChip }
}
