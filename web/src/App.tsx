import {
  Background,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import type { Graph } from '~shared/graph'
import type { ExpandDirection, FileCardData } from '~shared/toReactFlow'
import { toReactFlow } from '~shared/toReactFlow'
import FileCardNode from './FileCardNode'
import FilePalette from './FilePalette'

const nodeTypes = { fileCard: FileCardNode }

function readSeeds(): Set<string> {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(readSeeds)
  const [sourceExpanded, setSourceExpanded] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(() => readSeeds().size === 0)
  const { fitView } = useReactFlow()

  useEffect(() => {
    fetch('/graph')
      .then((r) => r.json())
      .then(setGraph)
      .catch((err) => console.error('failed to load graph', err))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const expand = useCallback(
    (path: string, direction: ExpandDirection) => {
      if (!graph) return
      setExpanded((prev) => {
        const next = new Set(prev)
        const related = direction === 'imports' ? graph.forward[path] : graph.reverse[path]
        for (const target of related ?? []) next.add(target)
        return next
      })
    },
    [graph],
  )

  const toggleSource = useCallback((path: string) => {
    setSourceExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    if (!graph) return
    toReactFlow(graph, expanded, sourceExpanded)
      .then(({ nodes: layoutNodes, edges: layoutEdges }) => {
        setNodes(
          layoutNodes.map((n) => ({
            ...n,
            data: { ...n.data, onExpand: expand, onToggleSource: toggleSource },
          })),
        )
        setEdges(layoutEdges)
      })
      .catch((err) => console.error('layout failed', err))
  }, [graph, expanded, sourceExpanded, expand, toggleSource, setNodes, setEdges])

  useEffect(() => {
    if (nodes.length > 0) fitView({ padding: 0.2, duration: 300 })
  }, [nodes, fitView])

  if (!graph) return <div className="loading">loading…</div>

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      <FilePalette
        graph={graph}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(path) => setExpanded((prev) => new Set([...prev, path]))}
      />
    </div>
  )
}
