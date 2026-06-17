import { type Edge, type Node, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef } from 'react'
import type { Graph } from '~shared/graph'
import { CARD_HEIGHT, type FileCardData, toReactFlow } from '~shared/toReactFlow'
import { type CardHandlers, mergeNodes } from './mergeNodes'

// Owns the canvas layout lifecycle: build → measure → re-layout → fit, plus
// focus-centering. App only renders the result and queues focus targets.
export function useCanvasLayout(
  graph: Graph | null,
  expanded: Set<string>,
  excluded: Set<string>,
  { onExpand, onShowSource, onRemove }: CardHandlers,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView, setCenter } = useReactFlow()
  // Path queued by the sidebar/palette to select + center once it's laid out.
  const focusRef = useRef<string | null>(null)
  const laidOutSig = useRef('')

  // Pass 1 — node/edge existence + data. Preserves prior position and measured
  // size for surviving nodes so an expand doesn't reset the laid-out canvas.
  useEffect(() => {
    if (!graph) return
    toReactFlow(graph, expanded, undefined, excluded)
      .then(({ nodes: layoutNodes, edges: layoutEdges }) => {
        setNodes((prev) => mergeNodes(prev, layoutNodes, { onExpand, onShowSource, onRemove }))
        setEdges(layoutEdges)
      })
      .catch((err) => console.error('layout failed', err))
  }, [graph, expanded, excluded, onExpand, onShowSource, onRemove, setNodes, setEdges])

  // Pass 2 — re-layout with the sizes React Flow actually measured, so cards
  // never overlap regardless of external rows or expanded source length.
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

  // Focus — once the queued node exists and is measured, select it (others
  // deselected) and center the viewport on it.
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

  const focus = useCallback((path: string) => {
    focusRef.current = path
  }, [])

  return { nodes, edges, onNodesChange, onEdgesChange, focus }
}
