import { type Edge, type Node, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import { CARD_HEIGHT, type FileCardData, layout, projectGraph } from '~shared/canvas'
import type { Graph } from '~shared/graph'
import { type CardHandlers, reconcileCanvasNodes } from '../lib/mergeNodes'

function collectMeasuredSizes(
  nodes: Node<FileCardData>[],
): Map<string, { width: number; height: number }> | null {
  const sizes = new Map<string, { width: number; height: number }>()
  for (const n of nodes) {
    const { width, height } = n.measured ?? {}
    if (!width || !height) return null
    sizes.set(n.id, { width, height })
  }
  return sizes
}

export function useCanvasLayout(
  graph: Graph | null,
  expanded: Set<string>,
  excluded: Set<string>,
  { onExpand, onShowSource, onRemove }: CardHandlers,
  seed: (path: string) => void,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView, setCenter } = useReactFlow()
  // Path queued by the sidebar/palette to select + center once it's laid out.
  const focusRef = useRef<string | null>(null)
  // Path of the card last expanded; pass 1 seeds its new neighbours nearby, then
  // clears it so a later seed/palette add doesn't reuse a stale anchor.
  const expansionAnchorRef = useRef<string | null>(null)
  const lastLayoutSig = useRef('')

  // Pass 1 — node/edge existence + data (pure, no elk). Preserves prior position
  // and measured size for surviving nodes; seeds new ones near the expand anchor.
  useEffect(() => {
    if (!graph) return
    const { nodes: projected, edges: projectedEdges } = projectGraph(graph, expanded, excluded)
    const anchorPath = expansionAnchorRef.current
    expansionAnchorRef.current = null
    // Record the expansion anchor before forwarding, so the next projection knows
    // which card the new neighbours should emerge from.
    const handlers: CardHandlers = {
      onExpand: (path, direction) => {
        expansionAnchorRef.current = path
        onExpand?.(path, direction)
      },
      onShowSource,
      onRemove,
    }
    setNodes((prev) => reconcileCanvasNodes(prev, projected, handlers, anchorPath))
    setEdges(projectedEdges)
  }, [graph, expanded, excluded, onExpand, onShowSource, onRemove, setNodes, setEdges])

  // Pass 2 — re-layout with the sizes React Flow actually measured, so cards
  // never overlap regardless of external rows or expanded source length.
  useEffect(() => {
    if (!graph || nodes.length === 0) return
    const sizes = collectMeasuredSizes(nodes)
    if (!sizes) return // wait until every node is measured
    const sig = [...sizes]
      .map(([id, s]) => `${id}:${s.width}:${s.height}`)
      .sort()
      .join('|')
    if (sig === lastLayoutSig.current) return
    lastLayoutSig.current = sig
    layout(nodes, edges, sizes)
      .then((laid) => {
        const pos = new Map(laid.map((n) => [n.id, n.position]))
        setNodes((prev) => prev.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })))
        fitView({ padding: 0.2, duration: 300 })
      })
      .catch((err) => console.error('layout failed', err))
  }, [nodes, edges, graph, setNodes, fitView])

  useEffect(() => {
    const path = focusRef.current
    if (!path) return
    const node = nodes.find((n) => n.id === path)
    if (!node?.measured?.width) return // wait for layout + measurement
    focusRef.current = null
    setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === path })))
    const w = node.measured.width
    const h = node.measured.height ?? CARD_HEIGHT
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { duration: 400 })
  }, [nodes, setNodes, setCenter])

  // Arm focus, then seed: the new card is queued to center the moment it's laid
  // out. The order is a canvas concern, so it lives here, not in the caller.
  function focusOn(path: string) {
    focusRef.current = path
    seed(path)
  }

  return { nodes, edges, onNodesChange, onEdgesChange, focusOn }
}
