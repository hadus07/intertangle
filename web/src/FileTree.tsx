import { useMemo } from 'react'
import { type TreeNode, buildTree, descendantFiles } from './treeBuilder'

interface Props {
  paths: string[]
  excluded: Set<string>
  onSetExcluded: (files: string[], exclude: boolean) => void
  onSeed: (path: string) => void
}

export default function FileTree({ paths, excluded, onSetExcluded, onSeed }: Props) {
  const tree = useMemo(() => buildTree(paths), [paths])
  return (
    <div className="iw-tree">
      {tree.map((node) => (
        <Row
          key={node.path}
          node={node}
          excluded={excluded}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </div>
  )
}

function Row({ node, excluded, onSetExcluded, onSeed }: { node: TreeNode } & Omit<Props, 'paths'>) {
  if (node.isFile) {
    const isExcluded = excluded.has(node.path)
    return (
      <div className="iw-tree-row">
        <input
          type="checkbox"
          checked={!isExcluded}
          onChange={() => onSetExcluded([node.path], !isExcluded)}
        />
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: label seeds a card, keyboard is via the canvas */}
        <span
          className={`iw-tree-label${isExcluded ? ' iw-tree-label--excluded' : ''}`}
          onClick={() => !isExcluded && onSeed(node.path)}
        >
          {node.name}
        </span>
      </div>
    )
  }

  const files = descendantFiles(node)
  const includedCount = files.filter((f) => !excluded.has(f)).length
  const allIncluded = includedCount === files.length
  const someIncluded = includedCount > 0 && !allIncluded

  return (
    <details open className="iw-tree-folder">
      <summary className="iw-tree-row">
        <input
          type="checkbox"
          checked={allIncluded}
          ref={(el) => {
            if (el) el.indeterminate = someIncluded
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onSetExcluded(files, allIncluded)}
        />
        <span className="iw-tree-label iw-tree-label--folder">{node.name}</span>
      </summary>
      {node.children.map((child) => (
        <Row
          key={child.path}
          node={child}
          excluded={excluded}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </details>
  )
}
