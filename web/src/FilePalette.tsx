import { Command } from 'cmdk'
import type { Graph } from '~shared/graph'

interface Props {
  graph: Graph
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 120,
  zIndex: 1000,
}

const dialogStyle: React.CSSProperties = {
  width: 560,
  maxHeight: 400,
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'sans-serif',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 14,
  border: 'none',
  borderBottom: '1px solid #eee',
  outline: 'none',
  boxSizing: 'border-box',
}

const listStyle: React.CSSProperties = {
  overflowY: 'auto',
  maxHeight: 320,
}

const itemStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

export default function FilePalette({ graph, open, onClose, onSelect }: Props) {
  if (!open) return null

  const paths = Object.keys(graph.nodes)

  function handleSelect(path: string) {
    onSelect(path)
    onClose()
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay click-to-dismiss
    <div style={overlayStyle} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation */}
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <Command label="File search">
          {/* ponytail: global style injected here to avoid a CSS file just for one rule */}
          <style>{`[cmdk-item][data-selected="true"] { background: #f0f0f0; }`}</style>
          <Command.Input
            autoFocus
            placeholder="Search files…"
            style={inputStyle}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <Command.List style={listStyle}>
            <Command.Empty style={{ padding: '12px 16px', fontSize: 13, color: '#999' }}>
              No files found.
            </Command.Empty>
            {paths.map((p) => {
              const name = p.split('/').pop() ?? p
              return (
                <Command.Item
                  key={p}
                  value={p}
                  onSelect={() => handleSelect(p)}
                  style={itemStyle}
                >
                  <span style={{ fontWeight: 600, color: '#111' }}>{name}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{p}</span>
                </Command.Item>
              )
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
