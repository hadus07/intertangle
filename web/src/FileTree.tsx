import { ChevronsDownUp, ChevronsUpDown, File, Folder } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type TreeNode, buildTree, descendantFiles } from './treeBuilder'

interface Props {
  paths: string[]
  excluded: Set<string>
  activePath?: string | null
  onSetExcluded: (files: string[], exclude: boolean) => void
  onSeed: (path: string) => void
}

const folderPaths = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.isFile ? [] : [n.path, ...folderPaths(n.children)]))

// Folders whose every descendant file is excluded — collapsed by default on load.
const fullyExcludedFolders = (nodes: TreeNode[], excluded: Set<string>): string[] =>
  nodes.flatMap((n) =>
    n.isFile || descendantFiles(n).some((f) => !excluded.has(f))
      ? n.isFile
        ? []
        : fullyExcludedFolders(n.children, excluded)
      : [n.path],
  )

export default function FileTree({ paths, excluded, activePath, onSetExcluded, onSeed }: Props) {
  const tree = useMemo(() => buildTree(paths), [paths])
  // ponytail: seed once from the restored exclusions; user toggles take over after.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(fullyExcludedFolders(tree, excluded)),
  )
  // Hydration: excluded starts empty and is restored after first render; reseed collapse then.
  const excludedSizeOnMount = useRef(excluded.size)
  const hasHydrated = excludedSizeOnMount.current === 0 && excluded.size > 0
  useEffect(() => {
    if (hasHydrated) {
      setCollapsed(new Set(fullyExcludedFolders(tree, excluded)))
    }
  }, [hasHydrated, tree, excluded])

  const collapseAll = () => setCollapsed(new Set(folderPaths(tree)))
  const expandAll = () => setCollapsed(new Set())

  // Reveal the selected file: drop any collapsed folder that is its ancestor.
  useEffect(() => {
    if (!activePath) return
    setCollapsed((prev) => {
      const next = new Set([...prev].filter((p) => !activePath.startsWith(`${p}/`)))
      return next.size === prev.size ? prev : next
    })
  }, [activePath])
  const onToggle = (path: string, open: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (open) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <div className="iw-tree">
      <div className="iw-tree-header">
        <button type="button" className="iw-icon-btn" title="Expand all" onClick={expandAll}>
          <ChevronsUpDown size={15} />
        </button>
        <button type="button" className="iw-icon-btn" title="Collapse all" onClick={collapseAll}>
          <ChevronsDownUp size={15} />
        </button>
      </div>
      {tree.map((node) => (
        <Row
          key={node.path}
          node={node}
          depth={0}
          collapsed={collapsed}
          onToggle={onToggle}
          excluded={excluded}
          activePath={activePath}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </div>
  )
}

// 20 = icon width (14) + gap (6), so a child's icon sits under its parent's text.
const indent = (depth: number) => ({ paddingLeft: 4 + depth * 20 })

function Row({
  node,
  depth,
  collapsed,
  onToggle,
  excluded,
  activePath,
  onSetExcluded,
  onSeed,
}: {
  node: TreeNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string, open: boolean) => void
} & Omit<Props, 'paths'>) {
  if (node.isFile) {
    const isExcluded = excluded.has(node.path)
    const isActive = node.path === activePath
    return (
      <div
        className={`iw-tree-row${isActive ? ' iw-tree-row--active' : ''}`}
        style={indent(depth)}
        ref={(el) => isActive && el?.scrollIntoView({ block: 'nearest' })}
      >
        <span className="iw-tree-icon">
          <File size={13} />
        </span>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: label seeds a card, keyboard is via the canvas */}
        <span
          className={`iw-tree-label${isExcluded ? ' iw-tree-label--excluded' : ''}`}
          onClick={() => !isExcluded && onSeed(node.path)}
        >
          {node.name}
        </span>
        <input
          type="checkbox"
          checked={!isExcluded}
          onChange={() => onSetExcluded([node.path], !isExcluded)}
        />
      </div>
    )
  }

  const files = descendantFiles(node)
  const includedCount = files.filter((f) => !excluded.has(f)).length
  const allIncluded = includedCount === files.length
  const someIncluded = includedCount > 0 && !allIncluded
  const fullyExcluded = includedCount === 0

  return (
    <details
      open={!collapsed.has(node.path)}
      onToggle={(e) => onToggle(node.path, e.currentTarget.open)}
      className="iw-tree-folder"
    >
      <summary className="iw-tree-row" style={indent(depth)}>
        <span className="iw-tree-icon">
          <Folder size={13} />
        </span>
        <span
          className={`iw-tree-label ${fullyExcluded ? 'iw-tree-label--excluded' : 'iw-tree-label--folder'}`}
        >
          {node.name}
        </span>
        <input
          type="checkbox"
          checked={allIncluded}
          ref={(el) => {
            if (el) el.indeterminate = someIncluded
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            onSetExcluded(files, allIncluded)
            if (allIncluded) onToggle(node.path, false) // deselecting → fold
          }}
        />
      </summary>
      {node.children.map((child) => (
        <Row
          key={child.path}
          node={child}
          depth={depth + 1}
          collapsed={collapsed}
          onToggle={onToggle}
          excluded={excluded}
          activePath={activePath}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </details>
  )
}
