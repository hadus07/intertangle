import { Handle, type NodeProps, Position } from '@xyflow/react'
import { useEffect, useState } from 'react'
import type { FileCardData } from '~shared/toReactFlow'

const chipStyle = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  borderRadius: 12,
  background: '#f5f5f5',
  fontSize: 11,
  color: '#333',
  cursor: 'pointer' as const,
  userSelect: 'none' as const,
}

export default function FileCardNode({ data }: NodeProps) {
  const { name, path, importCount, importedByCount, sourceExpanded, onExpand, onToggleSource } =
    data as Required<FileCardData>

  const [sourceHtml, setSourceHtml] = useState<string | null>(null)
  const [sourceStatus, setSourceStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!sourceExpanded) {
      setSourceHtml(null)
      setSourceStatus('idle')
      return
    }

    setSourceStatus('loading')
    fetch(`/file?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((html) => {
        setSourceHtml(html)
        setSourceStatus('idle')
      })
      .catch((err) => {
        console.error('failed to load source', err)
        setSourceStatus('error')
      })
  }, [sourceExpanded, path])

  return (
    <div
      style={{
        width: 240,
        padding: 12,
        border: '1px solid #ccc',
        borderRadius: 8,
        background: '#fff',
        fontFamily: 'sans-serif',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <button
        type="button"
        onClick={() => onToggleSource(path)}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          all: 'unset',
          display: 'block',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#111' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-word', marginBottom: 8 }}>
          {path}
        </div>
      </button>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          type="button"
          style={chipStyle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'imports')}
        >
          imports ({importCount}) ▶
        </button>
        <button
          type="button"
          style={chipStyle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'importedBy')}
        >
          ◀ imported by ({importedByCount})
        </button>
      </div>
      {sourceExpanded && (
        <div
          style={{
            maxHeight: 200,
            overflow: 'auto',
            border: '1px solid #eee',
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            background: '#fafafa',
          }}
        >
          {sourceStatus === 'loading' && <div>loading source…</div>}
          {sourceStatus === 'error' && <div style={{ color: '#c00' }}>failed to load source</div>}
          {sourceHtml != null && (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: server returns trusted Shiki-highlighted HTML
            <div dangerouslySetInnerHTML={{ __html: sourceHtml }} />
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
