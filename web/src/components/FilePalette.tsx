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

  const paths = allPaths.filter(p => !excluded.has(p))

  function handleSelect(path: string) {
    onSelect(path)
    onClose()
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay click-to-dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-dismiss
    <div
      className="fixed inset-0 bg-overlay-scrim flex items-start justify-center pt-30 z-1000 backdrop-blur"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation */}
      <div
        className="w-140 max-h-100 bg-dialog border border-strong rounded-[10px] shadow-[0_16px_48px_var(--iw-shadow-dialog)] overflow-hidden flex flex-col font-sans"
        onClick={e => e.stopPropagation()}
      >
        <Command label="File search">
          <Command.Input
            autoFocus
            placeholder="search files…"
            className="w-full px-4 py-3.5 text-[13px] font-mono border-0 border-b border-border bg-transparent text-text outline-none box-border caret-accent"
            value={query}
            onValueChange={setQuery}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          <Command.List ref={listRef} className="overflow-y-auto max-h-80">
            <Command.Empty className="px-4 py-3 font-mono text-[12px] text-faint">
              no files found
            </Command.Empty>
            {paths.map(p => {
              const name = p.split('/').pop() ?? p
              return (
                <Command.Item
                  key={p}
                  value={p}
                  onSelect={() => handleSelect(p)}
                  className="px-4 py-2.25 cursor-pointer flex flex-col gap-0.5 border-l-2 border-transparent transition-[background,border-color] duration-100 data-[selected=true]:bg-selected data-[selected=true]:border-l-accent"
                >
                  <span className="font-mono font-medium text-[12px] text-text">{name}</span>
                  <span className="font-mono text-[10px] text-muted">{p}</span>
                </Command.Item>
              )
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
