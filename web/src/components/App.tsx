import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'
import { Moon, PanelLeft, Search, Sun, Trash2 } from 'lucide-react'
import { use, useEffect, useRef } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { Graph, GraphNode } from '~shared/graph'

import { useCanvasLayout } from '../hooks/useCanvasLayout'
import { matchAny } from '../lib/glob'
import { parseUrlParams } from '../lib/urlParams'
import {
  AppStoreContext,
  computeCanvasExcluded,
  createAppStore,
  useAppStore,
  useAppStoreSnapshot,
} from '../store'
import { FileCardNode } from './FileCardNode'
import { FilePalette } from './FilePalette'
import { FileTree } from './FileTree'
import { GradientEdge } from './GradientEdge'
import { SourcePanel } from './SourcePanel'

const graphPromise: Promise<Graph> = fetch('/graph').then(r => r.json())
const nodeTypes = { fileCard: FileCardNode }
const edgeTypes = { gradient: GradientEdge }
const resizeHandleClassName =
  'w-px bg-border transition-colors duration-120 hover:bg-accent data-[resize-handle-state=drag]:bg-accent'

export function App() {
  const graph = use(graphPromise)
  const { seeds, scope } = parseUrlParams()
  return (
    <AppStoreContext.Provider value={createAppStore(graph, seeds)}>
      <AppCanvas graph={graph} scope={scope} />
    </AppStoreContext.Provider>
  )
}

function AppCanvas({ graph, scope }: { graph: Graph; scope: string[] }) {
  const expanded = useAppStore(s => s.expanded)
  const excluded = useAppStore(s => s.excluded)
  const sourcePath = useAppStore(s => s.sourcePath)
  const chips = useAppStore(s => s.chips)
  const theme = useAppStore(s => s.theme)
  const canvasExcluded = computeCanvasExcluded(excluded, chips, graph.nodes)
  const { seed, expand, showSource, hideSource, remove, clear, toggleTheme, setPaletteOpen } =
    useAppStoreSnapshot()

  const panelRef = useRef<ImperativePanelHandle>(null)
  const visiblePaths = filterVisiblePaths(graph.nodes, scope, chips)
  const { nodes, edges, onNodesChange, onEdgesChange, focusOn } = useCanvasLayout(
    graph,
    expanded,
    canvasExcluded,
    { onExpand: expand, onShowSource: showSource, onRemove: remove },
    seed,
  )

  function toggleSidebar() {
    const panel = panelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!e.metaKey && !e.ctrlKey) return
    e.preventDefault()
    if (e.key === 'k') {
      setPaletteOpen(true)
      return
    }
    if (e.key === 'b') toggleSidebar()
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable refs (panelRef) and stable setter (setPaletteOpen) — same semantics as the original []
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedNodes = nodes.filter(node => node.selected)
  const selectedPath = selectedNodes.length === 1 ? selectedNodes[0].id : null
  const edgesToRender = activateEdges(edges, new Set(selectedNodes.map(node => node.id)))

  const hasNoVisiblePaths = visiblePaths.length === 0

  return (
    <PanelGroup direction="horizontal" autoSaveId="intertangle:layout" style={{ height: '100vh' }}>
      <Panel
        ref={panelRef}
        collapsible
        collapsedSize={0}
        defaultSize={18}
        minSize={10}
        className="bg-sidebar border-r border-border font-mono text-[12px] text-text"
      >
        <div className="h-full overflow-auto">
          <FileTree paths={visiblePaths} activePath={selectedPath} onSeed={focusOn} />
        </div>
      </Panel>
      <PanelResizeHandle className={resizeHandleClassName} />
      <Panel>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <Toolbar
            theme={theme}
            onToggleSidebar={toggleSidebar}
            onOpenPalette={() => setPaletteOpen(true)}
            onClear={clear}
            onToggleTheme={toggleTheme}
          />
          {hasNoVisiblePaths && <EmptyProject />}
          <ReactFlow
            nodes={nodes}
            edges={edgesToRender}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            minZoom={0.05}
            fitView
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="var(--iw-border)"
              gap={24}
              size={1}
            />
            <Controls />
          </ReactFlow>
        </div>
      </Panel>
      {sourcePath && (
        <>
          <PanelResizeHandle className={resizeHandleClassName} />
          <Panel defaultSize={32} minSize={18} style={{ overflow: 'hidden' }}>
            <SourcePanel path={sourcePath} onClose={hideSource} />
          </Panel>
        </>
      )}
      <FilePalette paths={visiblePaths} onSelect={focusOn} />
    </PanelGroup>
  )
}

interface ToolbarProps {
  theme: 'light' | 'dark'
  onToggleSidebar(): void
  onOpenPalette(): void
  onClear(): void
  onToggleTheme(): void
}

function Toolbar({ theme, onToggleSidebar, onOpenPalette, onClear, onToggleTheme }: ToolbarProps) {
  return (
    <div className="absolute top-3 left-2 z-5 flex gap-2">
      <ToolbarButton title="Toggle sidebar (⌘B)" onClick={onToggleSidebar} icon={PanelLeft} />
      <ToolbarButton title="Search files (⌘K)" onClick={onOpenPalette} icon={Search} />
      <ToolbarButton title="Clear canvas" onClick={onClear} icon={Trash2} danger />
      <ToolbarButton
        title="Toggle theme"
        onClick={onToggleTheme}
        icon={theme === 'dark' ? Sun : Moon}
      />
    </div>
  )
}

const toolbarBaseClass =
  'inline-flex items-center justify-center w-7 h-7 p-0 border border-strong rounded-md bg-elevated text-muted cursor-pointer transition-colors duration-120 hover:text-accent-hover hover:border-accent'

interface ToolbarButtonProps {
  title: string
  onClick(): void
  icon: LucideIcon
  danger?: boolean
}

function ToolbarButton({ title, onClick, icon: Icon, danger }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`${toolbarBaseClass} ${danger ? 'hover:text-danger hover:border-danger' : ''}`}
      title={title}
      onClick={onClick}
    >
      <Icon size={15} />
    </button>
  )
}

function EmptyProject() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none z-5 p-6 font-mono text-[13px] text-muted text-center">
      No JavaScript or TypeScript files found in this project.
    </div>
  )
}

function filterVisiblePaths(
  nodes: Record<string, GraphNode>,
  scope: string[],
  chips: string[],
): string[] {
  const paths = Object.keys(nodes).filter(
    p => scope.length === 0 || scope.some(s => p === s || p.startsWith(`${s}/`)),
  )
  return chips.length ? paths.filter(p => !matchAny(chips, p)) : paths
}

function activateEdges(
  edges: ReturnType<typeof useCanvasLayout>['edges'],
  selectedIds: Set<string>,
) {
  if (selectedIds.size === 0) return edges
  return edges.map(e =>
    selectedIds.has(e.source) || selectedIds.has(e.target)
      ? { ...e, data: { ...e.data, active: true } }
      : e,
  )
}
