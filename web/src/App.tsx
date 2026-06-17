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
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import type { Graph } from '~shared/graph'
import type { ExpandDirection, FileCardData } from '~shared/toReactFlow'
import { toReactFlow } from '~shared/toReactFlow'
import FileCardNode from './FileCardNode'
import FilePalette from './FilePalette'
import FileTree from './FileTree'
import GradientEdge from './GradientEdge'

const nodeTypes = { fileCard: FileCardNode }
const edgeTypes = { gradient: GradientEdge }

function readSeeds(): Set<string> {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

const excludedKey = (root: string) => `interweave:excluded:${root}`

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(readSeeds)
  const [sourceExpanded, setSourceExpanded] = useState<Set<string>>(new Set())
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(() => readSeeds().size === 0)
  const panelRef = useRef<ImperativePanelHandle>(null)
  const { fitView } = useReactFlow()

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

  const toggleSource = useCallback((path: string) => {
    setSourceExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

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
    setExpanded((prev) => new Set([...prev, path]))
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Pass 1 — node/edge existence + data. Preserves prior position and measured
  // size for surviving nodes so an expand doesn't reset the laid-out canvas.
  useEffect(() => {
    if (!graph) return
    toReactFlow(graph, expanded, sourceExpanded, undefined, excluded)
      .then(({ nodes: layoutNodes, edges: layoutEdges }) => {
        setNodes((prev) => {
          const prevById = new Map(prev.map((n) => [n.id, n]))
          return layoutNodes.map((n) => {
            const old = prevById.get(n.id)
            return {
              ...n,
              position: old?.position ?? n.position,
              measured: old?.measured ?? n.measured,
              data: { ...n.data, onExpand: expand, onToggleSource: toggleSource },
            }
          })
        })
        setEdges(layoutEdges)
      })
      .catch((err) => console.error('layout failed', err))
  }, [graph, expanded, sourceExpanded, excluded, expand, toggleSource, setNodes, setEdges])

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
    toReactFlow(graph, expanded, sourceExpanded, sizes, excluded)
      .then(({ nodes: laid }) => {
        const pos = new Map(laid.map((n) => [n.id, n.position]))
        setNodes((prev) => prev.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })))
        fitView({ padding: 0.2, duration: 300 })
      })
      .catch((err) => console.error('layout failed', err))
  }, [nodes, graph, expanded, sourceExpanded, excluded, setNodes, fitView])

  if (!graph) return <div className="loading">loading…</div>

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
          paths={Object.keys(graph.nodes)}
          excluded={excluded}
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
            ‹›
          </button>
          <ReactFlow
            nodes={nodes}
            edges={edges}
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
      <FilePalette
        graph={graph}
        excluded={excluded}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={seed}
      />
    </PanelGroup>
  )
}
