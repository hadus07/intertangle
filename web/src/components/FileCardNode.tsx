import { Handle, type NodeProps, Position } from '@xyflow/react'
import { ArrowDownRight, ArrowUpLeft, Code2, X } from 'lucide-react'
import { memo } from 'react'
import type { FileCardData } from '~shared/canvas'

const extClass: Record<string, string> = {
  npm: 'iw-ext-npm',
  core: 'iw-ext-core',
  unresolved: 'iw-ext-unresolved',
}

// memo: React Flow re-renders every node on any nodes-array change (select, drag,
// pass-2 reposition). Position/selected updates keep data ref stable, so memo skips
// the re-render unless this card's own data actually changed.
function FileCardNode({ data }: NodeProps) {
  const { name, path, importCount, importedByCount, externals, onExpand, onShowSource, onRemove } =
    data as Required<FileCardData>

  return (
    <div className="iw-card">
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
      <div className="iw-card-header">
        <div className="iw-card-heading">
          <div className="iw-card-name">{name}</div>
          <div className="iw-card-path">{path}</div>
        </div>
        <div className="iw-card-actions">
          <button
            type="button"
            className="iw-card-action"
            title="View source"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onShowSource(path)}
          >
            <Code2 size={14} />
          </button>
          <button
            type="button"
            className="iw-card-action iw-card-action--remove"
            title="Remove from canvas"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(path)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="iw-chip-row">
        <button
          type="button"
          className="iw-chip iw-chip-imports"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'imports')}
        >
          <ArrowUpLeft size={12} /> imports {importCount}
        </button>
        <button
          type="button"
          className="iw-chip iw-chip-importedby"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'importedBy')}
        >
          imported by {importedByCount} <ArrowDownRight size={12} />
        </button>
      </div>
      {externals.length > 0 && (
        <div className="iw-ext-row">
          {externals.map((label) => (
            <span
              key={label.name}
              title={`${label.type}: ${label.name}`}
              className={`iw-ext-label ${extClass[label.type] ?? ''}`}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      <Handle type="target" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

export default memo(FileCardNode)
