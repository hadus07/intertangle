import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildTree, descendantFiles, type TreeNode } from '../../lib/treeBuilder'
import { useAppStore } from '../../store'
import { ChipInput } from './ChipInput'
import { FileTreeCtx } from './context'
import { Row } from './Row'

interface Props {
  paths: string[]
  activePath?: string | null
  onSeed: (path: string) => void
}

export function FileTree({ paths, activePath, onSeed }: Props) {
  const excluded = useAppStore(s => s.excluded)
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
    <FileTreeCtx.Provider value={{ activePath, activeRef, onSeed }}>
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
          <ChipInput />
        </div>
        {tree.map(node => (
          <Row key={node.path} node={node} depth={0} collapsed={collapsed} onToggle={onToggle} />
        ))}
      </div>
    </FileTreeCtx.Provider>
  )
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
