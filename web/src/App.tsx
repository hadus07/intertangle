import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Graph } from "~shared/graph";
import { toReactFlow } from "~shared/toReactFlow";
import FileCardNode from "./FileCardNode";

const nodeTypes = { fileCard: FileCardNode };

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const { fitView } = useReactFlow();

  useEffect(() => {
    fetch("/graph")
      .then((r) => r.json())
      .then(setGraph);
  }, []);

  const seeds = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("seeds");
    return raw ? new Set(raw.split(",")) : new Set<string>();
  }, []);

  const initial = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return toReactFlow(graph, seeds);
  }, [graph, seeds]);

  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    if (initial.nodes.length > 0) fitView({ padding: 0.2 });
  }, [initial.nodes, fitView]);

  if (!graph) return <div className="loading">loading…</div>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
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
    </div>
  );
}
