import type { Edge, Node } from '@xyflow/react'
import type { Graph } from './graph.js'

export const CARD_WIDTH = 240
export const CARD_HEIGHT = 120
export const CARD_HEIGHT_EXPANDED = 320

export type ExpandDirection = 'imports' | 'importedBy'

export interface FileCardData extends Record<string, unknown> {
  name: string
  path: string
  importCount: number
  importedByCount: number
  sourceExpanded?: boolean
  onExpand?(path: string, direction: ExpandDirection): void
  onToggleSource?(path: string): void
}

export async function toReactFlow(
  graph: Graph,
  visible: Set<string>,
  sourceExpanded?: Set<string>,
) {
  const nodes: Node<FileCardData>[] = []
  for (const id of [...visible].sort()) {
    const node = graph.nodes[id]
    if (!node) continue

    const isSourceExpanded = sourceExpanded?.has(id) ?? false
    const height = isSourceExpanded ? CARD_HEIGHT_EXPANDED : CARD_HEIGHT

    nodes.push({
      id,
      type: 'fileCard',
      position: { x: 0, y: 0 },
      data: {
        ...node,
        importCount: graph.forward[id]?.length ?? 0,
        importedByCount: graph.reverse[id]?.length ?? 0,
        sourceExpanded: isSourceExpanded,
      },
      measured: { width: CARD_WIDTH, height },
    })
  }

  const edges: Edge[] = []
  for (const [source, targets] of Object.entries(graph.forward)) {
    if (!visible.has(source)) continue
    for (const target of targets) {
      if (!visible.has(target)) continue
      edges.push({ id: `${source}->${target}`, source, target })
    }
  }

  if (nodes.length === 0) return { nodes, edges }

  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: CARD_WIDTH,
      height: n.measured?.height ?? CARD_HEIGHT,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  const layout = await elk.layout(elkGraph)
  for (const child of layout.children ?? []) {
    const node = nodeById.get(child.id)
    if (node) {
      node.position = { x: child.x ?? 0, y: child.y ?? 0 }
    }
  }

  return { nodes, edges }
}
