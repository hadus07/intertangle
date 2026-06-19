import { ChevronsDownUp, ChevronsUpDown, File, Folder, X } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { globToRegExp } from '../lib/glob'
import { buildTree, descendantFiles, type TreeNode } from '../lib/treeBuilder'

function ChipInput({
  chips,
  onAddChip,
  onRemoveChip,
}: {
  chips: string[]
  onAddChip: (p: string) => void
  onRemoveChip: (p: string) => void
}) {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  function flashInvalid() {
    setInvalid(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setInvalid(false), 600)
  }

  function commit() {
    const val = value.trim()
    if (!val) return
    if (chips.includes(val)) {
      setValue('')
      return
    }
    try {
      globToRegExp(val)
    } catch {
      flashInvalid()
      return
    }
    onAddChip(val)
    setValue('')
  }

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        placeholder="hide glob… (Enter)"
        className={cn(
          'w-full px-2 py-1 text-[11px] font-mono rounded border bg-transparent text-secondary outline-none caret-accent placeholder:text-faint transition-colors duration-120 focus:border-accent',
          invalid ? 'border-danger' : 'border-strong',
        )}
      />
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {chips.map(chip => (
            <span
              key={chip}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-elevated border border-strong text-secondary"
            >
              {chip}
              <button
                type="button"
                onClick={() => onRemoveChip(chip)}
                className="inline-flex items-center justify-center w-3 h-3 text-muted hover:text-danger cursor-pointer"
                aria-label={`Remove ${chip}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

interface Props {
  paths: string[]
  excluded: Set<string>
  activePath?: string | null
  onSetExcluded: (files: string[], exclude: boolean) => void
  onSeed: (path: string) => void
  chips: string[]
  onAddChip: (pattern: string) => void
  onRemoveChip: (pattern: string) => void
}

function folderPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap(n => (n.isFile ? [] : [n.path, ...folderPaths(n.children)]))
}

function fullyExcludedFolders(nodes: TreeNode[], excluded: Set<string>): string[] {
  return nodes.flatMap(n =>
    n.isFile || descendantFiles(n).some(f => !excluded.has(f))
      ? n.isFile
        ? []
        : fullyExcludedFolders(n.children, excluded)
      : [n.path],
  )
}

export default function FileTree({
  paths,
  excluded,
  activePath,
  onSetExcluded,
  onSeed,
  chips,
  onAddChip,
  onRemoveChip,
}: Props) {
  const tree = buildTree(paths)
  // ponytail: seed once from the restored exclusions; user toggles take over after.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(fullyExcludedFolders(tree, excluded)),
  )
  const activeRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the re-run triggers, not body reads
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center' })
  }, [activePath, collapsed])

  const collapseAll = () => setCollapsed(new Set(folderPaths(tree)))
  const expandAll = () => setCollapsed(new Set())

  // Reveal the selected file: drop any collapsed folder that is its ancestor.
  useEffect(() => {
    if (!activePath) return
    setCollapsed(prev => {
      const next = new Set([...prev].filter(p => !activePath.startsWith(`${p}/`)))
      return next.size === prev.size ? prev : next
    })
  }, [activePath])

  function onToggle(path: string, open: boolean) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (open) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const allCollapsed = folderPaths(tree).every(p => collapsed.has(p))

  const iconBtnClass =
    'inline-flex items-center justify-center w-5 h-5 p-0 border border-strong rounded-md bg-elevated text-muted cursor-pointer transition-colors duration-120 hover:text-accent-hover hover:border-accent'

  return (
    <div className="px-1 pb-2">
      <div className="sticky top-0 z-1 px-2 pt-3 pb-1.5 mb-1 border-b border-border bg-sidebar">
        <div className="flex justify-end gap-1 mb-1.5">
          <div className="flex-1">
            <span className="text-sm font-semibold tracking-tight">intertangle</span>
          </div>
          <button
            type="button"
            className={iconBtnClass}
            title={allCollapsed ? 'Expand all' : 'Collapse all'}
            onClick={allCollapsed ? expandAll : collapseAll}
          >
            {allCollapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
          </button>
        </div>
        <ChipInput chips={chips} onAddChip={onAddChip} onRemoveChip={onRemoveChip} />
      </div>
      {tree.map(node => (
        <Row
          key={node.path}
          node={node}
          depth={0}
          collapsed={collapsed}
          onToggle={onToggle}
          excluded={excluded}
          activePath={activePath}
          activeRef={activeRef}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </div>
  )
}

function FileRow({
  node,
  depth,
  excluded,
  activePath,
  activeRef,
  onSetExcluded,
  onSeed,
}: {
  node: TreeNode
  depth: number
  excluded: Set<string>
  activePath?: string | null
  activeRef: RefObject<HTMLDivElement | null>
  onSetExcluded: Props['onSetExcluded']
  onSeed: Props['onSeed']
}) {
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

const ICON_WIDTH = 14
const ICON_GAP = 6
const INDENT_STEP = ICON_WIDTH + ICON_GAP
const indent = (depth: number) => ({ paddingLeft: 4 + depth * INDENT_STEP })

function Row({
  node,
  depth,
  collapsed,
  onToggle,
  excluded,
  activePath,
  activeRef,
  onSetExcluded,
  onSeed,
}: {
  node: TreeNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string, open: boolean) => void
  activeRef: RefObject<HTMLDivElement | null>
} & Omit<Props, 'paths' | 'chips' | 'onAddChip' | 'onRemoveChip'>) {
  if (node.isFile) {
    return (
      <FileRow
        node={node}
        depth={depth}
        excluded={excluded}
        activePath={activePath}
        activeRef={activeRef}
        onSetExcluded={onSetExcluded}
        onSeed={onSeed}
      />
    )
  }

  const files = descendantFiles(node)
  const includedCount = files.filter(f => !excluded.has(f)).length
  const allIncluded = includedCount === files.length
  const someIncluded = includedCount > 0 && !allIncluded
  const fullyExcluded = includedCount === 0

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
            if (allIncluded) onToggle(node.path, false) // deselecting → fold
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
          excluded={excluded}
          activePath={activePath}
          activeRef={activeRef}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </details>
  )
}
