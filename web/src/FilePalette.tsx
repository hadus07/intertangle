import { Command } from 'cmdk'
import { useEffect, useRef, useState } from 'react'

interface Props {
  paths: string[]
  excluded: Set<string>
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}

export default function FilePalette({ paths: allPaths, excluded, open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // cmdk keeps the active item in view, which scrolls the list down as results
  // reorder while typing. Snap back to the top on every query change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect is intentionally triggered by query change
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query])

  if (!open) return null

  const paths = allPaths.filter((p) => !excluded.has(p))

  function handleSelect(path: string) {
    onSelect(path)
    onClose()
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay click-to-dismiss
    <div className="iw-palette-overlay" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation */}
      <div className="iw-palette-dialog" onClick={(e) => e.stopPropagation()}>
        <Command label="File search">
          <Command.Input
            autoFocus
            placeholder="search files…"
            className="iw-palette-input"
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <Command.List ref={listRef} className="iw-palette-list">
            <Command.Empty className="iw-palette-empty">no files found</Command.Empty>
            {paths.map((p) => {
              const name = p.split('/').pop() ?? p
              return (
                <Command.Item
                  key={p}
                  value={p}
                  onSelect={() => handleSelect(p)}
                  className="iw-palette-item"
                >
                  <span className="iw-palette-item-name">{name}</span>
                  <span className="iw-palette-item-path">{p}</span>
                </Command.Item>
              )
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
