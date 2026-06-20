import type { Edge, Node } from '@xyflow/react'
import type { CardHandlers, FileCardData } from '../../../src/shared/canvas.js'
import { layout as layoutGeometry, projectGraph } from '../../../src/shared/canvas.js'
import type { Graph } from '../../../src/shared/graph.js'

const STACK_OFFSET = 24

export type Focus = { path: string; needsLayout: boolean } | null
export type NodeSize = { width: number; height: number }
export type Sizes = { key: string; sizes: Map<string, NodeSize> }

export type CameraAction = { type: 'center'; x: number; y: number } | { type: 'fit' }

export type GraphState = {
  visible: Set<string>
  excluded: Set<string>
}

export type LayoutResult = {
  nodes: Node<FileCardData>[]
  edges: Edge[]
  camera: CameraAction
  selectedPath: string | undefined
}

// Single seam: graph state → render-ready nodes/edges.
// Preserves prior positions/sizes, injects card handlers, and decides whether
// the next render needs a full geometry pass.
export function project(
  graph: Graph,
  state: GraphState,
  prev: Node<FileCardData>[],
  handlers: CardHandlers,
  options?: { anchor?: string | null; focus?: Focus },
): {
  nodes: Node<FileCardData>[]
  edges: Edge[]
  needsLayout: boolean
  layoutKey: string | null
} {
  const { nodes: projected, edges } = projectGraph(graph, state.visible, state.excluded)
  const merged = mergeNodes(prev, projected, handlers, options?.anchor)
  const focus = options?.focus ?? null
  const selectedPath = selectedPathFromFocus(focus)
  const nodes = selectedPath === undefined ? merged : markSelected(merged, selectedPath)
  const sizes = measure(nodes)
  const layoutKey = sizes?.key ?? null
  const needsLayout = focus ? focus.needsLayout : true

  return { nodes, edges, needsLayout, layoutKey }
}

// Collect measured sizes into a stable key. Returns null until every visible node
// has a non-zero measured size — elk cannot be run safely on partial data.
export function measure(nodes: Node<FileCardData>[]): Sizes | null {
  const sizes = new Map<string, NodeSize>()
  for (const node of nodes) {
    const size = nodeSize(node)
    if (!size) return null
    sizes.set(node.id, size)
  }
  const key = [...sizes]
    .map(([id, size]) => `${id}:${size.width}:${size.height}`)
    .sort()
    .join('|')
  return { key, sizes }
}

// Async geometry: run the given layout backend (default elk) and return positioned
// nodes plus a camera action. This is the only place that touches elk.
export async function layout(
  input: {
    nodes: Node<FileCardData>[]
    edges: Edge[]
    sizes: Map<string, NodeSize>
    focus?: Focus
  },
  options?: { layoutBackend?: LayoutBackend },
): Promise<LayoutResult> {
  try {
    const backend = options?.layoutBackend ?? layoutGeometry
    const laid = await backend(input.nodes, input.edges, input.sizes)
    const nodes = applyPositions(input.nodes, laid)
    const focus = input.focus ?? null
    const selectedPath = selectedPathFromFocus(focus)
    const selectedNodes = selectedPath === undefined ? nodes : markSelected(nodes, selectedPath)
    const camera = cameraForSelected(selectedNodes, laid, selectedPath)
    return { nodes: selectedNodes, edges: input.edges, camera, selectedPath }
  } catch (err) {
    console.error('layout failed', err)
    return {
      nodes: input.nodes,
      edges: input.edges,
      camera: { type: 'fit' },
      selectedPath: selectedPathFromFocus(input.focus ?? null),
    }
  }
}

export type LayoutBackend = (
  nodes: Node<FileCardData>[],
  edges: Edge[],
  sizes: Map<string, NodeSize>,
) => Promise<Node<FileCardData>[]>

// Merge freshly-projected nodes over the previous render: keep prior position and
// measured size for surviving cards (so an expand doesn't reset the laid-out
// canvas) and inject the card callbacks, which projectGraph leaves undefined.
// Brand-new nodes have no prior position (projectGraph seeds them at 0,0); when an
// expand supplies an anchor, fan them out from the expanded card so they emerge
// from under it instead of piling at the origin.
function mergeNodes(
  prev: Node<FileCardData>[],
  next: Node<FileCardData>[],
  handlers: CardHandlers,
  anchorPath?: string | null,
): Node<FileCardData>[] {
  const prevById = new Map(prev.map(node => [node.id, node]))
  const anchor = anchorPath ? prevById.get(anchorPath)?.position : undefined
  let newCardCount = 0
  return next.map(node => {
    const old = prevById.get(node.id)
    const position = old
      ? old.position
      : anchor
        ? fanOutPosition(anchor, ++newCardCount)
        : node.position
    return {
      ...node,
      position,
      measured: old?.measured ?? node.measured,
      data: { ...node.data, ...handlers },
    }
  })
}

function fanOutPosition(anchor: { x: number; y: number }, index: number) {
  return {
    x: anchor.x + STACK_OFFSET * index,
    y: anchor.y + STACK_OFFSET * index,
  }
}

function applyPositions(
  prev: Node<FileCardData>[],
  laid: Node<FileCardData>[],
): Node<FileCardData>[] {
  const posById = new Map(laid.map(node => [node.id, node.position]))
  return prev.map(node => ({
    ...node,
    position: posById.get(node.id) ?? node.position,
  }))
}

function markSelected(
  nodes: Node<FileCardData>[],
  selectedPath: string | undefined,
): Node<FileCardData>[] {
  if (selectedPath === undefined) return nodes
  return nodes.map(node => ({ ...node, selected: node.id === selectedPath }))
}

function nodeSize(node: Node<FileCardData>): NodeSize | null {
  const { width, height } = node.measured ?? {}
  if (!width || !height) return null
  return { width, height }
}

function selectedPathFromFocus(focus: Focus): string | undefined {
  return focus?.needsLayout ? focus.path : undefined
}

export function cameraForNode(
  node: Node<FileCardData>,
  position: { x: number; y: number },
): CameraAction {
  const size = nodeSize(node)
  if (!size) return { type: 'fit' }
  return {
    type: 'center',
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  }
}

function cameraForSelected(
  nodes: Node<FileCardData>[],
  laid: Node<FileCardData>[],
  selectedPath: string | undefined,
): CameraAction {
  if (!selectedPath) return { type: 'fit' }
  const node = nodes.find(node => node.id === selectedPath)
  const position = laid.find(node => node.id === selectedPath)?.position
  if (!node || !position) return { type: 'fit' }
  return cameraForNode(node, position)
}
