import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { FileCardData } from '../src/shared/canvas.js'
import { reconcileCanvasNodes } from '../web/src/lib/mergeNodes.js'

const handlers = {
  onExpand: () => {},
  onShowSource: () => {},
  onRemove: () => {},
}

function node(id: string, x: number, measured?: { width: number; height: number }) {
  return {
    id,
    type: 'fileCard',
    position: { x, y: 0 },
    data: { name: id, path: id, importCount: 0, importedByCount: 0, externals: [] },
    measured,
  } as unknown as Node<FileCardData>
}

describe('mergeNodes', () => {
  it('keeps prior position and measured size for surviving nodes', () => {
    const prev = [node('a.ts', 100, { width: 240, height: 130 })]
    const next = [node('a.ts', 0)] // freshly built at origin, unmeasured
    const [merged] = reconcileCanvasNodes(prev, next, handlers)

    expect(merged.position).toEqual({ x: 100, y: 0 })
    expect(merged.measured).toEqual({ width: 240, height: 130 })
  })

  it('uses fresh position for nodes absent from the previous render', () => {
    const prev = [node('a.ts', 100)]
    const next = [node('a.ts', 0), node('b.ts', 50)]
    const byId = Object.fromEntries(
      reconcileCanvasNodes(prev, next, handlers).map((n) => [n.id, n]),
    )

    expect(byId['a.ts'].position.x).toBe(100) // preserved
    expect(byId['b.ts'].position.x).toBe(50) // new node, fresh layout
  })

  it('seeds new nodes near the expand anchor when one is given', () => {
    const prev = [node('a.ts', 100)] // anchor card sits at x:100
    const next = [node('a.ts', 0), node('b.ts', 0), node('c.ts', 0)] // b,c freshly at origin
    const byId = Object.fromEntries(
      reconcileCanvasNodes(prev, next, handlers, 'a.ts').map((n) => [n.id, n]),
    )

    expect(byId['a.ts'].position.x).toBe(100) // survivor preserved
    // new nodes fan out from the anchor, not the origin
    expect(byId['b.ts'].position.x).toBeGreaterThan(100)
    expect(byId['c.ts'].position.x).toBeGreaterThan(byId['b.ts'].position.x)
  })

  it('injects the card handlers into every node', () => {
    const [merged] = reconcileCanvasNodes([], [node('a.ts', 0)], handlers)

    expect(merged.data.onExpand).toBe(handlers.onExpand)
    expect(merged.data.onShowSource).toBe(handlers.onShowSource)
    expect(merged.data.onRemove).toBe(handlers.onRemove)
  })
})
