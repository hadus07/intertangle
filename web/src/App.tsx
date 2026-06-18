import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import { PanelLeft, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import type { Graph } from '~shared/graph'
import FileCardNode from './FileCardNode'
import FilePalette from './FilePalette'
import FileTree from './FileTree'
import GradientEdge from './GradientEdge'
import SourcePanel from './SourcePanel'
import { useCanvasLayout } from './useCanvasLayout'
import { useGraphView } from './useGraphView'

const nodeTypes = { fileCard: FileCardNode }
const edgeTypes = { gradient: GradientEdge }

// Folder/file args that restrict which paths the tree + palette list.
const SCOPE = (() => {
  const raw = new URLSearchParams(window.location.search).get('scope')
  return raw ? raw.split(',').filter(Boolean) : []
})()

const inScope = (p: string) =>
  SCOPE.length === 0 || SCOPE.some((s) => p === s || p.startsWith(`${s}/`))

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
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

  useEffect(() => {
    fetch('/graph')
      .then((r) => r.json())
      .then(setGraph)
      .catch((err) => console.error('failed to load graph', err))
  }, [])

  const toggleSidebar = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])

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

  if (!graph) return <div className="loading">loading…</div>

  const scopedPaths = Object.keys(graph.nodes).filter(inScope)

  return (
    <PanelGroup direction="horizontal" autoSaveId="intertangle:layout" style={{ height: '100vh' }}>
      <Panel
        ref={panelRef}
        collapsible
        collapsedSize={0}
        defaultSize={18}
        minSize={10}
        className="iw-sidebar"
        style={{ overflow: 'auto' }}
      >
        <FileTree
          paths={scopedPaths}
          excluded={excluded}
          activePath={selectedPath}
          onSetExcluded={setExclusion}
          onSeed={focusOn}
        />
      </Panel>
      <PanelResizeHandle className="iw-resize-handle" />
      <Panel>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <button
            type="button"
            className="iw-collapse-toggle"
            title="Toggle sidebar (⌘B)"
            onClick={toggleSidebar}
          >
            <PanelLeft size={15} />
          </button>
          <button
            type="button"
            className="iw-search-btn"
            title="Search files (⌘K)"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={15} />
          </button>
          <button type="button" className="iw-clear-canvas" title="Clear canvas" onClick={clear}>
            <Trash2 size={15} />
          </button>
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
          <PanelResizeHandle className="iw-resize-handle" />
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
