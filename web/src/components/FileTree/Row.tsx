import { File, Folder } from 'lucide-react'
import { cn } from '../../lib/cn'
import { descendantFiles, type TreeNode } from '../../lib/treeBuilder'
import { useAppStore, useAppStoreSnapshot } from '../../store'
import { useFileTreeCtx } from './context'

const ICON_WIDTH = 14
const ICON_GAP = 6
const INDENT_STEP = ICON_WIDTH + ICON_GAP
const indent = (depth: number) => ({ paddingLeft: 4 + depth * INDENT_STEP })

function FileRow({ node, depth }: { node: TreeNode; depth: number }) {
  const { setExclusion: onSetExcluded } = useAppStoreSnapshot()
  const excluded = useAppStore(s => s.excluded)
  const { activePath, activeRef, onSeed } = useFileTreeCtx()
  const isExcluded = excluded.has(node.path)
  const isActive = node.path === activePath
  const iconColor = isActive ? 'text-accent-hover' : 'text-muted'
  const labelColor = isActive
    ? 'text-accent-active'
    : isExcluded
      ? 'text-faint line-through cursor-default hover:text-faint'
      : 'text-secondary'
  const checkOpacity = isActive ? 'opacity-100' : ''
  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-1 py-0.5 rounded cursor-default whitespace-nowrap',
        isActive && 'bg-accent-wash shadow-[inset_2px_0_0_var(--iw-accent)]',
      )}
      style={indent(depth)}
      ref={isActive ? activeRef : undefined}
    >
      <span className={cn('inline-flex items-center justify-center shrink-0 w-3.5', iconColor)}>
        <File size={13} />
      </span>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: label seeds a card, keyboard is via the canvas */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: label seeds a card, keyboard is via the canvas */}
      <span
        className={cn(
          'cursor-pointer overflow-hidden text-ellipsis flex-1 min-w-0 hover:text-accent-hover',
          labelColor,
        )}
        onClick={() => !isExcluded && onSeed(node.path)}
      >
        {node.name}
      </span>
      <input
        type="checkbox"
        checked={!isExcluded}
        className={cn(
          'ml-auto shrink-0 w-3.5 h-3.5 cursor-pointer m-0 accent-accent transition-opacity duration-120 opacity-30 group-hover:opacity-100',
          checkOpacity,
        )}
        onChange={() => onSetExcluded([node.path], !isExcluded)}
      />
    </div>
  )
}

function computeFolderInclusion(files: string[], excluded: Set<string>) {
  const includedCount = files.filter(file => !excluded.has(file)).length
  const allIncluded = includedCount === files.length
  const someIncluded = includedCount > 0 && !allIncluded
  const fullyExcluded = includedCount === 0
  return { allIncluded, someIncluded, fullyExcluded }
}

export function Row({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: TreeNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string, open: boolean) => void
}) {
  const { setExclusion: onSetExcluded } = useAppStoreSnapshot()
  const excluded = useAppStore(s => s.excluded)
  if (node.isFile) {
    return <FileRow node={node} depth={depth} />
  }

  const files = descendantFiles(node)
  const { allIncluded, someIncluded, fullyExcluded } = computeFolderInclusion(files, excluded)

  return (
    <details
      open={!collapsed.has(node.path)}
      onToggle={e => onToggle(node.path, e.currentTarget.open)}
    >
      <summary
        className="group flex items-center gap-1.5 px-1 py-0.5 rounded cursor-default whitespace-nowrap list-none"
        style={indent(depth)}
      >
        <span className="inline-flex items-center justify-center shrink-0 w-3.5 text-muted">
          <Folder size={13} />
        </span>
        <span
          className={cn(
            'overflow-hidden text-ellipsis flex-1 min-w-0',
            fullyExcluded ? 'text-faint line-through cursor-default' : 'text-muted cursor-default',
          )}
        >
          {node.name}
        </span>
        <input
          type="checkbox"
          checked={allIncluded}
          ref={el => {
            if (el) el.indeterminate = someIncluded
          }}
          className="ml-auto shrink-0 w-3.5 h-3.5 cursor-pointer m-0 accent-accent transition-opacity duration-120 opacity-30 group-hover:opacity-100"
          onClick={e => e.stopPropagation()}
          onChange={() => {
            onSetExcluded(files, allIncluded)
            if (allIncluded) onToggle(node.path, false)
          }}
        />
      </summary>
      {node.children.map(child => (
        <Row
          key={child.path}
          node={child}
          depth={depth + 1}
          collapsed={collapsed}
          onToggle={onToggle}
        />
      ))}
    </details>
  )
}
