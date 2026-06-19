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
  // True when focusRef targets a card not yet on canvas — Pass 2 handles the pan
  // after layout so the focus effect doesn't fire early with position {0,0}.
  const focusAfterLayoutRef = useRef(false)
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
    setNodes(prev => reconcileCanvasNodes(prev, projected, handlers, anchorPath))
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

    // Returns true if it handled the pan so applyLayout can skip fitView.
    function panToNewCard(focusPath: string, pos: Map<string, { x: number; y: number }>) {
      focusAfterLayoutRef.current = false
      focusRef.current = null
      const focusPos = pos.get(focusPath)
      const focusNode = nodes.find(n => n.id === focusPath)
      if (focusPos && focusNode?.measured?.width) {
        const w = focusNode.measured.width
        const h = focusNode.measured.height ?? CARD_HEIGHT
        setCenter(focusPos.x + w / 2, focusPos.y + h / 2, { duration: 400 })
        return true
      }
      return false
    }

    function applyLayout(laid: Node<FileCardData>[]) {
      const pos = new Map(laid.map(n => [n.id, n.position]))
      const focusPath = focusRef.current
      const isFocusAfterLayout = focusAfterLayoutRef.current
      setNodes(prev =>
        prev.map(n => ({
          ...n,
          position: pos.get(n.id) ?? n.position,
          ...(isFocusAfterLayout && focusPath && { selected: n.id === focusPath }),
        })),
      )
      if (isFocusAfterLayout && focusPath && panToNewCard(focusPath, pos)) return
      fitView({ padding: 0.2, duration: 300 })
    }

    layout(nodes, edges, sizes)
      .then(applyLayout)
      .catch(err => console.error('layout failed', err))
  }, [nodes, edges, graph, setNodes, fitView, setCenter])

  // Handles focus for cards already on canvas (layout is a no-op for them).
  useEffect(() => {
    if (focusAfterLayoutRef.current) return // new card: Pass 2 will handle it
    const path = focusRef.current
    if (!path) return
    const node = nodes.find(n => n.id === path)
    if (!node?.measured?.width) return
    focusRef.current = null
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === path })))
    const w = node.measured.width
    const h = node.measured.height ?? CARD_HEIGHT
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { duration: 400 })
  }, [nodes, setNodes, setCenter])

  // Arm focus, then seed. For cards not yet on canvas, flag that layout must
  // complete first so the focus effect doesn't fire early with position {0,0}.
  function focusOn(path: string) {
    focusRef.current = path
    focusAfterLayoutRef.current = !nodes.some(n => n.id === path)
    seed(path)
  }

  return { nodes, edges, onNodesChange, onEdgesChange, focusOn }
}
