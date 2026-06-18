import { Handle, type NodeProps, Position } from '@xyflow/react'
import { ArrowDownRight, ArrowUpLeft, Code2, X } from 'lucide-react'
import { memo } from 'react'
import type { FileCardData } from '~shared/canvas'

const extClass: Record<string, string> = {
  npm: 'bg-ext-npm-bg border border-ext-npm-border text-ext-npm',
  core: 'bg-ext-core-bg border border-ext-core-border text-info',
  unresolved: 'bg-ext-unresolved-bg border border-ext-unresolved-border text-ext-unresolved',
}

const actionBase =
  '[all:unset] flex items-center justify-center w-4.5 h-4.5 rounded text-[12px] leading-none text-muted cursor-pointer transition-[color,background] duration-150'

// memo: React Flow re-renders every node on any nodes-array change (select, drag,
// pass-2 reposition). Position/selected updates keep data ref stable, so memo skips
// the re-render unless this card's own data actually changed.
function FileCardNode({ data }: NodeProps) {
  const { name, path, importCount, importedByCount, externals, onExpand, onShowSource, onRemove } =
    data as Required<FileCardData>

  return (
    <div className="inline-flex flex-col border border-strong border-t-2 border-t-accent rounded-lg bg-elevated font-sans text-text overflow-hidden [.react-flow__node.selected_&]:border-accent [.react-flow__node.selected_&]:shadow-[0_0_0_1px_var(--iw-accent),0_0_20px_var(--iw-accent-glow)]">
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-start gap-2 pt-2.5 pr-2.5 pb-2 pl-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono font-medium text-[13px] text-text mb-1 tracking-[-0.02em] whitespace-nowrap">
            {name}
          </div>
          <div className="font-mono text-[10px] text-muted whitespace-nowrap leading-normal">
            {path}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            className={`${actionBase} hover:text-accent-hover hover:bg-accent-wash-soft`}
            title="View source"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onShowSource(path)}
          >
            <Code2 size={14} />
          </button>
          <button
            type="button"
            className={`${actionBase} hover:text-danger hover:bg-danger-wash`}
            title="Remove from canvas"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(path)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 px-2.5 pt-1.5 pb-2 border-t border-border">
        <button
          type="button"
          className="appearance-none bg-transparent outline-none flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-[5px] text-[11px] font-sans cursor-pointer whitespace-nowrap transition-[border-color,color,background] duration-150 tracking-[0.01em] border border-chip-imports text-accent-dim hover:border-accent hover:text-accent-hover hover:bg-accent-wash-faint"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'imports')}
        >
          <ArrowUpLeft size={12} /> imports {importCount}
        </button>
        <button
          type="button"
          className="appearance-none bg-transparent outline-none flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-[5px] text-[11px] font-sans cursor-pointer whitespace-nowrap transition-[border-color,color,background] duration-150 tracking-[0.01em] border border-chip-importedby text-info-dim hover:border-info hover:text-info-hover hover:bg-info-wash"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'importedBy')}
        >
          imported by {importedByCount} <ArrowDownRight size={12} />
        </button>
      </div>
      {externals.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {externals.map((label) => (
            <span
              key={label.name}
              title={`${label.type}: ${label.name}`}
              className={`px-1.75 py-0.5 rounded-[10px] text-[10px] font-sans select-none whitespace-nowrap tracking-[0.01em] ${extClass[label.type] ?? ''}`}
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
