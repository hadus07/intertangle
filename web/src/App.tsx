import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { PanelLeft, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import type { Graph } from '~shared/graph'
import type { ExpandDirection, FileCardData } from '~shared/toReactFlow'
import { CARD_HEIGHT, toReactFlow } from '~shared/toReactFlow'
import FileCardNode from './FileCardNode'
import FilePalette from './FilePalette'
import FileTree from './FileTree'
import GradientEdge from './GradientEdge'
import SourcePanel from './SourcePanel'

const nodeTypes = { fileCard: FileCardNode }
const edgeTypes = { gradient: GradientEdge }

function readSeeds(): Set<string> {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

// Folder/file args that restrict which paths the tree + palette list.
const SCOPE = (() => {
  const raw = new URLSearchParams(window.location.search).get('scope')
  return raw ? raw.split(',').filter(Boolean) : []
})()

const inScope = (p: string) =>
  SCOPE.length === 0 || SCOPE.some((s) => p === s || p.startsWith(`${s}/`))

const excludedKey = (root: string) => `interweave:excluded:${root}`

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(readSeeds)
  const [sourcePath, setSourcePath] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)
  const { fitView, setCenter } = useReactFlow()
  // Path queued by the sidebar to select + center once it's laid out & measured.
  const focusRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/graph')
      .then((r) => r.json())
      .then((g: Graph) => {
        setGraph(g)
        const saved = localStorage.getItem(excludedKey(g.root))
        if (saved) setExcluded(new Set(JSON.parse(saved)))
      })
      .catch((err) => console.error('failed to load graph', err))
  }, [])

  // Persist exclusions per project. graph.root keys it so projects don't collide.
  useEffect(() => {
    if (!graph) return
    localStorage.setItem(excludedKey(graph.root), JSON.stringify([...excluded]))
  }, [excluded, graph])

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

  const expand = useCallback(
    (path: string, direction: ExpandDirection) => {
      if (!graph) return
      setExpanded((prev) => {
        const next = new Set(prev)
        const related = direction === 'imports' ? graph.forward[path] : graph.reverse[path]
        for (const target of related ?? []) if (!excluded.has(target)) next.add(target)
        return next
      })
    },
    [graph, excluded],
  )

  const showSource = useCallback((path: string) => setSourcePath(path), [])

  const setExclusion = useCallback((files: string[], exclude: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const f of files) {
        if (exclude) next.add(f)
        else next.delete(f)
      }
      return next
    })
  }, [])

  const seed = useCallback((path: string) => {
    focusRef.current = path
    setExpanded((prev) => new Set([...prev, path]))
  }, [])

  const clearCanvas = useCallback(() => {
    setExpanded(new Set())
    setSourcePath(null)
  }, [])

  const remove = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
    setSourcePath((prev) => (prev === path ? null : prev))
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Pass 1 — node/edge existence + data. Preserves prior position and measured
  // size for surviving nodes so an expand doesn't reset the laid-out canvas.
  useEffect(() => {
    if (!graph) return
    toReactFlow(graph, expanded, undefined, excluded)
      .then(({ nodes: layoutNodes, edges: layoutEdges }) => {
        setNodes((prev) => {
          const prevById = new Map(prev.map((n) => [n.id, n]))
          return layoutNodes.map((n) => {
            const old = prevById.get(n.id)
            return {
              ...n,
              position: old?.position ?? n.position,
              measured: old?.measured ?? n.measured,
              data: { ...n.data, onExpand: expand, onShowSource: showSource, onRemove: remove },
            }
          })
        })
        setEdges(layoutEdges)
      })
      .catch((err) => console.error('layout failed', err))
  }, [graph, expanded, excluded, expand, showSource, remove, setNodes, setEdges])

  // Pass 2 — re-layout with the sizes React Flow actually measured, so cards
  // never overlap regardless of external rows or expanded source length.
  const laidOutSig = useRef('')
  useEffect(() => {
    if (!graph || nodes.length === 0) return
    const sizes = new Map<string, { width: number; height: number }>()
    for (const n of nodes) {
      const { width, height } = n.measured ?? {}
      if (!width || !height) return // wait until every node is measured
      sizes.set(n.id, { width, height })
    }
    const sig = [...sizes]
      .map(([id, s]) => `${id}:${s.width}:${s.height}`)
      .sort()
      .join('|')
    if (sig === laidOutSig.current) return
    laidOutSig.current = sig
    toReactFlow(graph, expanded, sizes, excluded)
      .then(({ nodes: laid }) => {
        const pos = new Map(laid.map((n) => [n.id, n.position]))
        setNodes((prev) => prev.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })))
        fitView({ padding: 0.2, duration: 300 })
      })
      .catch((err) => console.error('layout failed', err))
  }, [nodes, graph, expanded, excluded, setNodes, fitView])

  // Sidebar focus — once the queued node exists and is measured, select it
  // (others deselected) and center the viewport on it.
  useEffect(() => {
    const path = focusRef.current
    if (!path) return
    const node = nodes.find((n) => n.id === path)
    if (!node?.measured?.width) return // wait for layout + measurement
    focusRef.current = null
    setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === path })))
    const w = node.measured.width
    const h = node.measured.height ?? CARD_HEIGHT
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1, duration: 400 })
  }, [nodes, setNodes, setCenter])

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
    <PanelGroup direction="horizontal" autoSaveId="interweave:layout" style={{ height: '100vh' }}>
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
          onSeed={seed}
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
          <button
            type="button"
            className="iw-clear-canvas"
            title="Clear canvas"
            onClick={clearCanvas}
          >
            <Trash2 size={15} />
          </button>
          <ReactFlow
            nodes={nodes}
            edges={edgesToRender}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} color="#1a1c2c" gap={24} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </Panel>
      {sourcePath && (
        <>
          <PanelResizeHandle className="iw-resize-handle" />
          <Panel defaultSize={32} minSize={18} style={{ overflow: 'hidden' }}>
            <SourcePanel path={sourcePath} onClose={() => setSourcePath(null)} />
          </Panel>
        </>
      )}
      <FilePalette
        paths={scopedPaths}
        excluded={excluded}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={seed}
      />
    </PanelGroup>
  )
}
