import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import { PanelLeft, Search, Trash2 } from 'lucide-react'
import { use, useEffect, useRef, useState } from 'react'
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import type { Graph } from '~shared/graph'

const graphPromise: Promise<Graph> = fetch('/graph').then((r) => r.json())
import { useCanvasLayout } from '../hooks/useCanvasLayout'
import { useGraphView } from '../hooks/useGraphView'
import FileCardNode from './FileCardNode'
import FilePalette from './FilePalette'
import FileTree from './FileTree'
import GradientEdge from './GradientEdge'
import SourcePanel from './SourcePanel'

const nodeTypes = { fileCard: FileCardNode }
const edgeTypes = { gradient: GradientEdge }

function parseScopeParam(): string[] {
  const raw = new URLSearchParams(window.location.search).get('scope')
  return raw ? raw.split(',').filter(Boolean) : []
}

const SCOPE = parseScopeParam()

function inScope(p: string) {
  return SCOPE.length === 0 || SCOPE.some((s) => p === s || p.startsWith(`${s}/`))
}

export default function App() {
  const graph = use(graphPromise)
  const {
    expanded,
    excluded,
    sourcePath,
    expand,
    seed,
    showSource,
    hideSource,
    remove,
    setExclusion,
    clear,
  } = useGraphView(graph)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)
  const { nodes, edges, onNodesChange, onEdgesChange, focusOn } = useCanvasLayout(
    graph,
    expanded,
    excluded,
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

  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedPath = selectedNodes.length === 1 ? selectedNodes[0].id : null
  const selectedIds = new Set(selectedNodes.map((n) => n.id))
  const edgesToRender =
    selectedIds.size === 0
      ? edges
      : edges.map((e) =>
          selectedIds.has(e.source) || selectedIds.has(e.target)
            ? { ...e, data: { ...e.data, active: true } }
            : e,
        )

  const scopedPaths = Object.keys(graph.nodes).filter(inScope)

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
          <FileTree
            paths={scopedPaths}
            excluded={excluded}
            activePath={selectedPath}
            onSetExcluded={setExclusion}
            onSeed={focusOn}
          />
        </div>
      </Panel>
      <PanelResizeHandle className="w-px bg-border transition-colors duration-120 hover:bg-accent data-[resize-handle-state=drag]:bg-accent" />
      <Panel>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <button
            type="button"
            className="absolute top-3 left-2 z-5 inline-flex items-center justify-center w-7 h-7 p-0 border border-strong rounded-md bg-elevated text-muted cursor-pointer transition-colors duration-120 hover:text-accent-hover hover:border-accent"
            title="Toggle sidebar (⌘B)"
            onClick={toggleSidebar}
          >
            <PanelLeft size={15} />
          </button>
          <button
            type="button"
            className="absolute top-3 left-11 z-5 inline-flex items-center justify-center w-7 h-7 p-0 border border-strong rounded-md bg-elevated text-muted cursor-pointer transition-colors duration-120 hover:text-accent-hover hover:border-accent"
            title="Search files (⌘K)"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={15} />
          </button>
          <button
            type="button"
            className="absolute top-3 left-20 z-5 inline-flex items-center justify-center w-7 h-7 p-0 border border-strong rounded-md bg-elevated text-muted cursor-pointer transition-colors duration-120 hover:text-danger hover:border-danger"
            title="Clear canvas"
            onClick={clear}
          >
            <Trash2 size={15} />
          </button>
          {scopedPaths.length === 0 && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none z-5 p-6 font-mono text-[13px] text-muted text-center">
              No JavaScript or TypeScript files found in this project.
            </div>
          )}
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
          <PanelResizeHandle className="w-px bg-border transition-colors duration-120 hover:bg-accent data-[resize-handle-state=drag]:bg-accent" />
          <Panel defaultSize={32} minSize={18} style={{ overflow: 'hidden' }}>
            <SourcePanel path={sourcePath} onClose={hideSource} />
          </Panel>
        </>
      )}
      <FilePalette
        paths={scopedPaths}
        excluded={excluded}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={focusOn}
      />
    </PanelGroup>
  )
}
