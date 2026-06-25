import type { Edge, Node } from '@xyflow/react'
import type { ExternalLabel, Graph, GraphNode } from './graph.js'

export const CARD_WIDTH = 240
export const CARD_HEIGHT = 120

export type ExpandDirection = 'imports' | 'importedBy'

export interface CardHandlers {
  onExpand?(path: string, direction: ExpandDirection): void
  onShowSource?(path: string): void
  onRemove?(path: string): void
}

export interface FileCardData extends GraphNode, CardHandlers, Record<string, unknown> {
  importCount: number
  importedByCount: number
  externals: ExternalLabel[]
  importsExpandable: boolean
  importedByExpandable: boolean
}

function buildNodeData(
  graph: Graph,
  id: string,
  visible: Set<string>,
  excluded: Set<string> | undefined,
): FileCardData {
  const node = graph.nodes[id] as GraphNode
  const fwd = graph.forward[id] ?? []
  const rev = graph.reverse[id] ?? []
  const notExcluded = (p: string) => !excluded?.has(p)
  return {
    ...node,
    importCount: fwd.filter(notExcluded).length,
    importedByCount: rev.filter(notExcluded).length,
    externals: graph.external[id] ?? [],
    importsExpandable: fwd.some(p => notExcluded(p) && !visible.has(p)),
    importedByExpandable: rev.some(p => notExcluded(p) && !visible.has(p)),
  }
}

function buildNodes(
  graph: Graph,
  visible: Set<string>,
  excluded?: Set<string>,
): Node<FileCardData>[] {
  const nodes: Node<FileCardData>[] = []
  for (const id of [...visible].sort()) {
    if (excluded?.has(id)) continue
    if (!graph.nodes[id]) continue
    nodes.push({
      id,
      type: 'fileCard',
      position: { x: 0, y: 0 },
      data: buildNodeData(graph, id, visible, excluded),
      measured: { width: CARD_WIDTH, height: CARD_HEIGHT },
    })
  }
  return nodes
}

function addVisibleEdges(
  source: string,
  targets: string[],
  visible: Set<string>,
  excluded: Set<string> | undefined,
  edges: Edge[],
) {
  if (!visible.has(source) || excluded?.has(source)) return
  for (const target of targets) {
    if (!visible.has(target) || excluded?.has(target)) continue
    edges.push({ id: `${source}->${target}`, source, target, type: 'gradient' })
  }
}

function buildEdges(graph: Graph, visible: Set<string>, excluded?: Set<string>): Edge[] {
  const edges: Edge[] = []
  for (const [source, targets] of Object.entries(graph.forward))
    addVisibleEdges(source, targets, visible, excluded, edges)
  return edges
}

// Pure projection: graph + visible set (minus excluded) → React Flow nodes/edges.
// No positions (all 0,0) and no elk — layout() owns geometry. Counts are net of
// exclusion so a card's chips reflect only what's currently on the canvas.
export function projectGraph(
  graph: Graph,
  visible: Set<string>,
  excluded?: Set<string>,
): { nodes: Node<FileCardData>[]; edges: Edge[] } {
  return {
    nodes: buildNodes(graph, visible, excluded),
    edges: buildEdges(graph, visible, excluded),
  }
}

// Geometry-only seam: position the given nodes with elk and return them with
// positions filled. elk is dynamically imported so the pure projection path
// never pays its cost. `sizes` are the real DOM sizes React Flow measured;
// cards are content-driven so the CARD_* constants are only a first-paint
// fallback — without measured sizes elk packs for the wrong box and cards overlap.
export async function layout(
  nodes: Node<FileCardData>[],
  edges: Edge[],
  sizes?: Map<string, { width: number; height: number }>,
): Promise<Node<FileCardData>[]> {
  if (nodes.length === 0) return nodes

  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // LEFT so a node's imports render to its left (imports chip side) and its
      // importers to its right (imported-by chip side) — edges leave from the
      // matching chip, less crossing over the card.
      'elk.direction': 'LEFT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      // Honor the (alphabetical) input order within each layer instead of
      // letting elk reshuffle to minimize crossings — keeps cards in a stable
      // vertical order so the hierarchy doesn't jump around on each expansion.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: nodes.map(node => {
      const measuredSize = sizes?.get(node.id)
      return {
        id: node.id,
        width: measuredSize?.width ?? CARD_WIDTH,
        height: measuredSize?.height ?? node.measured?.height ?? CARD_HEIGHT,
      }
    }),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  const result = await elk.layout(elkGraph)
  const posById = new Map((result.children ?? []).map(c => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]))
  return nodes.map(n => ({ ...n, position: posById.get(n.id) ?? n.position }))
}
