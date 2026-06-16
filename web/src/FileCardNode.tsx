import { Handle, Position, type NodeProps } from "@xyflow/react";

export default function FileCardNode({ data }: NodeProps) {
  const { name, path } = data as { name: string; path: string };
  return (
    <div
      style={{
        width: 240,
        padding: 12,
        border: "1px solid #ccc",
        borderRadius: 8,
        background: "#fff",
        fontFamily: "sans-serif",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "#111" }}>{name}</div>
      <div style={{ fontSize: 12, color: "#666", wordBreak: "break-word" }}>{path}</div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
