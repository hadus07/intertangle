import type { Edge, Node } from '@xyflow/react'
import type { ExternalLabel, Graph } from './graph.js'

export const CARD_WIDTH = 240
export const CARD_HEIGHT = 120
export const CARD_HEIGHT_EXPANDED = 320

export type ExpandDirection = 'imports' | 'importedBy'

export interface FileCardData extends Record<string, unknown> {
  name: string
  path: string
  importCount: number
  importedByCount: number
  externals: ExternalLabel[]
  sourceExpanded?: boolean
  onExpand?(path: string, direction: ExpandDirection): void
  onToggleSource?(path: string): void
}

export async function toReactFlow(
  graph: Graph,
  visible: Set<string>,
  sourceExpanded?: Set<string>,
  // Real DOM sizes measured by React Flow; cards are content-driven so the
  // CARD_* constants are only a first-paint fallback. Without this, elk packs
  // for the wrong box and rendered cards overlap.
  sizes?: Map<string, { width: number; height: number }>,
  excluded?: Set<string>,
) {
  const nodes: Node<FileCardData>[] = []
  for (const id of [...visible].sort()) {
    if (excluded?.has(id)) continue
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
        importCount: (graph.forward[id] ?? []).filter((p) => !excluded?.has(p)).length,
        importedByCount: (graph.reverse[id] ?? []).filter((p) => !excluded?.has(p)).length,
        externals: graph.external[id] ?? [],
        sourceExpanded: isSourceExpanded,
      },
      measured: { width: CARD_WIDTH, height },
    })
  }

  const edges: Edge[] = []
  for (const [source, targets] of Object.entries(graph.forward)) {
    if (!visible.has(source) || excluded?.has(source)) continue
    for (const target of targets) {
      if (!visible.has(target) || excluded?.has(target)) continue
      edges.push({ id: `${source}->${target}`, source, target, type: 'gradient' })
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
    },
    children: nodes.map((n) => {
      const s = sizes?.get(n.id)
      return {
        id: n.id,
        width: s?.width ?? CARD_WIDTH,
        height: s?.height ?? n.measured?.height ?? CARD_HEIGHT,
      }
    }),
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
