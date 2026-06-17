import { Command } from 'cmdk'
import type { Graph } from '~shared/graph'

interface Props {
  graph: Graph
  excluded: Set<string>
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}

export default function FilePalette({ graph, excluded, open, onClose, onSelect }: Props) {
  if (!open) return null

  const paths = Object.keys(graph.nodes).filter((p) => !excluded.has(p))

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
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <Command.List className="iw-palette-list">
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
