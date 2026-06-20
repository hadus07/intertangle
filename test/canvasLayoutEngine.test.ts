import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { FileCardData } from '../src/shared/canvas.js'
import { layout, measure, project } from '../web/src/lib/canvasLayoutEngine.js'

const handlers = {
  onExpand: () => {},
  onShowSource: () => {},
  onRemove: () => {},
}

function node(
  id: string,
  x: number,
  measured?: { width: number; height: number },
  selected = false,
): Node<FileCardData> {
  return {
    id,
    type: 'fileCard',
    position: { x, y: 0 },
    data: { name: id, path: id, importCount: 0, importedByCount: 0, externals: [] },
    measured,
    selected,
  } as unknown as Node<FileCardData>
}

function graphWithNodes(...paths: string[]) {
  const nodes: Record<string, { path: string; name: string }> = {}
  for (const p of paths) nodes[p] = { path: p, name: p }
  return {
    root: '/tmp',
    nodes,
    forward: {},
    reverse: {},
    external: {},
  }
}

describe('measure', () => {
  it('collects sizes for all measured nodes', () => {
    const sizes = measure([
      node('a.ts', 0, { width: 100, height: 200 }),
      node('b.ts', 0, { width: 150, height: 250 }),
    ])

    expect(sizes).not.toBeNull()
    expect(sizes?.sizes.get('a.ts')).toEqual({ width: 100, height: 200 })
    expect(sizes?.sizes.get('b.ts')).toEqual({ width: 150, height: 250 })
  })

  it('returns null if any node is unmeasured', () => {
    expect(measure([node('a.ts', 0, { width: 100, height: 200 }), node('b.ts', 0)])).toBeNull()
  })

  it('produces a stable key that changes when sizes change', () => {
    const first = measure([node('a.ts', 0, { width: 100, height: 200 })])
    const second = measure([node('a.ts', 0, { width: 100, height: 201 })])

    expect(first?.key).not.toBe(second?.key)
  })
})

describe('project', () => {
  it('projects nodes from a graph and attaches handlers', () => {
    const graph = graphWithNodes('a.ts', 'b.ts')
    const { nodes, edges } = project(
      graph,
      { visible: new Set(['a.ts', 'b.ts']), excluded: new Set() },
      [],
      handlers,
    )

    expect(nodes.map(n => n.id).sort()).toEqual(['a.ts', 'b.ts'])
    expect(nodes[0].data.onExpand).toBe(handlers.onExpand)
    expect(edges).toEqual([])
  })

  it('keeps prior position and measured size for surviving nodes', () => {
    const prev = [node('a.ts', 100, { width: 240, height: 130 })]
    const graph = graphWithNodes('a.ts')
    const { nodes } = project(
      graph,
      { visible: new Set(['a.ts']), excluded: new Set() },
      prev,
      handlers,
    )

    expect(nodes[0].position).toEqual({ x: 100, y: 0 })
    expect(nodes[0].measured).toEqual({ width: 240, height: 130 })
  })

  it('seeds new nodes near the expand anchor when one is given', () => {
    const prev = [node('a.ts', 100)]
    const graph = graphWithNodes('a.ts', 'b.ts', 'c.ts')
    const { nodes } = project(
      graph,
      { visible: new Set(['a.ts', 'b.ts', 'c.ts']), excluded: new Set() },
      prev,
      handlers,
      { anchor: 'a.ts' },
    )

    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId['a.ts'].position.x).toBe(100)
    expect(byId['b.ts'].position.x).toBeGreaterThan(100)
    expect(byId['c.ts'].position.x).toBeGreaterThan(byId['b.ts'].position.x)
  })

  it('marks the focus node as selected when focus needs layout', () => {
    const graph = graphWithNodes('a.ts')
    const { nodes } = project(
      graph,
      { visible: new Set(['a.ts']), excluded: new Set() },
      [],
      handlers,
      { focus: { path: 'a.ts', needsLayout: true } },
    )

    expect(nodes[0].selected).toBe(true)
  })

  it('does not mark the focus node when focus is just a camera pan', () => {
    const graph = graphWithNodes('a.ts')
    const { nodes, needsLayout } = project(
      graph,
      { visible: new Set(['a.ts']), excluded: new Set() },
      [],
      handlers,
      { focus: { path: 'a.ts', needsLayout: false } },
    )

    expect(needsLayout).toBe(false)
    expect(nodes[0].selected).toBeUndefined()
  })

  it('excludes nodes marked as excluded', () => {
    const graph = graphWithNodes('a.ts', 'b.ts')
    const { nodes } = project(
      graph,
      { visible: new Set(['a.ts', 'b.ts']), excluded: new Set(['b.ts']) },
      [],
      handlers,
    )

    expect(nodes.map(n => n.id)).toEqual(['a.ts'])
  })
})

describe('layout', () => {
  it('applies positions from the backend and centers on the focus node', async () => {
    const nodes = [node('a.ts', 0, { width: 200, height: 100 })]
    const edges: Edge[] = []
    const sizes = new Map([['a.ts', { width: 200, height: 100 }]])

    const result = await layout(
      { nodes, edges, sizes, focus: { path: 'a.ts', needsLayout: true } },
      {
        layoutBackend: async nodes =>
          nodes.map(n => ({
            ...n,
            position: { x: 50, y: 60 },
          })),
      },
    )

    expect(result.nodes[0].position).toEqual({ x: 50, y: 60 })
    expect(result.nodes[0].selected).toBe(true)
    expect(result.camera).toEqual({ type: 'center', x: 150, y: 110 })
  })

  it('falls back to fit when the focus node is unmeasured', async () => {
    const nodes = [node('a.ts', 0)]
    const edges: Edge[] = []
    const sizes = new Map()

    const result = await layout(
      { nodes, edges, sizes, focus: { path: 'a.ts', needsLayout: true } },
      {
        layoutBackend: async nodes =>
          nodes.map(n => ({
            ...n,
            position: { x: 0, y: 0 },
          })),
      },
    )

    expect(result.camera).toEqual({ type: 'fit' })
  })

  it('falls back to fit view when there is no focus', async () => {
    const nodes = [node('a.ts', 0, { width: 100, height: 100 })]
    const edges: Edge[] = []
    const sizes = new Map([['a.ts', { width: 100, height: 100 }]])

    const result = await layout(
      { nodes, edges, sizes },
      {
        layoutBackend: async nodes =>
          nodes.map(n => ({
            ...n,
            position: { x: 10, y: 20 },
          })),
      },
    )

    expect(result.camera).toEqual({ type: 'fit' })
  })

  it('survives a backend failure by fitting the view', async () => {
    const nodes = [node('a.ts', 0, { width: 100, height: 100 })]
    const edges: Edge[] = []
    const sizes = new Map([['a.ts', { width: 100, height: 100 }]])

    const result = await layout(
      { nodes, edges, sizes, focus: { path: 'a.ts', needsLayout: true } },
      {
        layoutBackend: async () => {
          throw new Error('boom')
        },
      },
    )

    expect(result.camera).toEqual({ type: 'fit' })
  })
})
