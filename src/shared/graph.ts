export interface GraphNode {
  path: string;
  name: string;
}

export interface Graph {
  root: string;
  nodes: Record<string, GraphNode>;
  forward: Record<string, string[]>;
  external: Record<string, string[]>;
}
