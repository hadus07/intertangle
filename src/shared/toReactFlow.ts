import type { Edge, Node } from "@xyflow/react";
import type { Graph } from "./graph.js";

const CARD_WIDTH = 240;
const CARD_HEIGHT = 120;
const GAP = 40;

export interface ReactFlowGraph {
  nodes: Node<{ name: string; path: string }>[];
  edges: Edge[];
}

export function toReactFlow(graph: Graph, visible: Set<string>): ReactFlowGraph {
  const nodes: Node<{ name: string; path: string }>[] = [];
  const edges: Edge[] = [];

  let index = 0;
  for (const id of [...visible].sort()) {
    const node = graph.nodes[id];
    if (!node) continue;

    nodes.push({
      id,
      type: "fileCard",
      position: { x: index * (CARD_WIDTH + GAP), y: 0 },
      data: node,
      measured: { width: CARD_WIDTH, height: CARD_HEIGHT },
    });
    index++;
  }

  for (const [source, targets] of Object.entries(graph.forward)) {
    if (!visible.has(source)) continue;
    for (const target of targets) {
      if (!visible.has(target)) continue;
      edges.push({
        id: `${source}->${target}`,
        source,
        target,
      });
    }
  }

  return { nodes, edges };
}
