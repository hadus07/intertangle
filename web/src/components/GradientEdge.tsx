import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react'
import { memo } from 'react'

// Gradient encodes import direction: amber (importer) → cyan (imported).
// userSpaceOnUse + real endpoint coords is required, else the gradient maps to
// the path bounding box and misaligns on near-vertical/horizontal edges.
function GradientEdge({
  id,
  data,
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
  const active = data?.active === true
  // Dimmed edges drop the directional gradient for flat grey, so amber→cyan
  // colour reads only on the selected card's links.
  const style = active
    ? {
        stroke: `url(#g-${id})`,
        strokeWidth: 1.2,
        filter: 'drop-shadow(0 0 3px var(--iw-accent-glow))',
      }
    : { stroke: 'var(--iw-edge)', strokeWidth: 1 }
  return (
    <>
      {active && (
        <defs>
          <linearGradient
            id={`g-${id}`}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
          >
            <stop offset="0%" style={{ stopColor: 'var(--iw-edge-from)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--iw-edge-to)' }} />
          </linearGradient>
        </defs>
      )}
      <BaseEdge id={id} path={path} style={style} />
    </>
  )
}

export default memo(GradientEdge)
