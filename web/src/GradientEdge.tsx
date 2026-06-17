import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react'
import { memo } from 'react'

// Gradient encodes import direction: amber (importer) → cyan (imported).
// userSpaceOnUse + real endpoint coords is required, else the gradient maps to
// the path bounding box and misaligns on near-vertical/horizontal edges.
function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  return (
    <>
      <defs>
        <linearGradient
          id={`g-${id}`}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <BaseEdge id={id} path={path} style={{ stroke: `url(#g-${id})`, strokeWidth: 2 }} />
    </>
  )
}

export default memo(GradientEdge)
