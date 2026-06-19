import { describe, expect, it } from 'vitest'
import { CARD_HEIGHT, CARD_WIDTH, layout, projectGraph } from '../src/shared/canvas.js'
import type { Graph } from '../src/shared/graph.js'

const graph: Graph = {
  root: '/x',
  nodes: {
    'a.ts': { path: 'a.ts', name: 'a.ts' },
    'b.ts': { path: 'b.ts', name: 'b.ts' },
    'c.ts': { path: 'c.ts', name: 'c.ts' },
  },
  forward: {
    'a.ts': ['b.ts'],
    'b.ts': ['c.ts'],
    'c.ts': [],
  },
  reverse: {
    'a.ts': [],
    'b.ts': ['a.ts'],
    'c.ts': ['b.ts'],
  },
  external: {
    'a.ts': [{ name: 'react', type: 'npm' as const }],
    'b.ts': [],
    'c.ts': [],
  },
}

const cycleGraph: Graph = {
  root: '/cycle',
  nodes: {
    'src/a.ts': { path: 'src/a.ts', name: 'a.ts' },
    'src/b.ts': { path: 'src/b.ts', name: 'b.ts' },
    'src/c.ts': { path: 'src/c.ts', name: 'c.ts' },
  },
  forward: {
    'src/a.ts': ['src/b.ts'],
    'src/b.ts': ['src/c.ts'],
    'src/c.ts': ['src/a.ts'],
  },
  reverse: {
    'src/a.ts': ['src/c.ts'],
    'src/b.ts': ['src/a.ts'],
    'src/c.ts': ['src/b.ts'],
  },
  external: {},
}

describe('projectGraph', () => {
  it('returns nodes and edges for the visible set only', () => {
    const { nodes, edges } = projectGraph(graph, new Set(['a.ts', 'b.ts']))

    expect(nodes.map(n => n.id).sort()).toEqual(['a.ts', 'b.ts'])
    expect(edges).toEqual([{ id: 'a.ts->b.ts', source: 'a.ts', target: 'b.ts', type: 'gradient' }])
  })

  it('includes import and imported-by counts in node data', () => {
    const { nodes } = projectGraph(graph, new Set(['a.ts', 'b.ts', 'c.ts']))
    const byId = Object.fromEntries(nodes.map(n => [n.id, n.data]))

    expect(byId['a.ts']).toMatchObject({ importCount: 1, importedByCount: 0 })
    expect(byId['b.ts']).toMatchObject({ importCount: 1, importedByCount: 1 })
    expect(byId['c.ts']).toMatchObject({ importCount: 0, importedByCount: 1 })
  })

  it('passes external labels through to node data', () => {
    const { nodes } = projectGraph(graph, new Set(['a.ts', 'b.ts', 'c.ts']))
    const byId = Object.fromEntries(nodes.map(n => [n.id, n.data]))

    expect(byId['a.ts'].externals).toEqual([{ name: 'react', type: 'npm' }])
    expect(byId['b.ts'].externals).toEqual([])
  })

  it('drops excluded nodes and edges touching them', () => {
    const { nodes, edges } = projectGraph(
      graph,
      new Set(['a.ts', 'b.ts', 'c.ts']),
      new Set(['b.ts']),
    )

    expect(nodes.map(n => n.id).sort()).toEqual(['a.ts', 'c.ts'])
    // a->b and b->c both touch the excluded b.ts, so no edges remain.
    expect(edges).toEqual([])
  })

  it('discounts excluded neighbours from the chip counts', () => {
    const { nodes } = projectGraph(graph, new Set(['a.ts', 'b.ts', 'c.ts']), new Set(['b.ts']))
    const byId = Object.fromEntries(nodes.map(n => [n.id, n.data]))

    // a.ts's only import (b.ts) is excluded, and c.ts's only importer (b.ts) too.
    expect(byId['a.ts']).toMatchObject({ importCount: 0 })
    expect(byId['c.ts']).toMatchObject({ importedByCount: 0 })
  })

  it('projects import cycles without dropping edges', () => {
    const { nodes, edges } = projectGraph(cycleGraph, new Set(Object.keys(cycleGraph.nodes)))
    expect(nodes).toHaveLength(3)
    expect(edges.map(e => e.id).sort()).toEqual([
      'src/a.ts->src/b.ts',
      'src/b.ts->src/c.ts',
      'src/c.ts->src/a.ts',
    ])
  })
})

describe('layout', () => {
  const lay = (visible: Set<string>, excluded?: Set<string>) => {
    const { nodes, edges } = projectGraph(graph, visible, excluded)
    return layout(nodes, edges)
  }
  const pos = (ns: Awaited<ReturnType<typeof layout>>) =>
    ns.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }))

  it('produces deterministic positions for the same visible set', async () => {
    const visible = new Set(['a.ts', 'b.ts', 'c.ts'])
    expect(pos(await lay(visible))).toEqual(pos(await lay(visible)))
  })

  it('does not overlap node rectangles', async () => {
    const nodes = await lay(new Set(['a.ts', 'b.ts', 'c.ts']))

    const BOX_W = CARD_WIDTH + 40
    const BOX_H = CARD_HEIGHT + 40
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const overlapX = Math.abs(a.position.x - b.position.x) < BOX_W
        const overlapY = Math.abs(a.position.y - b.position.y) < BOX_H
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })

  it('stays deterministic and overlap-free with an excluded set', async () => {
    const visible = new Set(['a.ts', 'b.ts', 'c.ts'])
    const excluded = new Set(['b.ts'])
    const first = await lay(visible, excluded)
    expect(pos(first)).toEqual(pos(await lay(visible, excluded)))

    // True AABB non-overlap: surviving disconnected nodes stack with a small
    // gap, so the loose center-distance heuristic doesn't apply here.
    for (let i = 0; i < first.length; i++) {
      for (let j = i + 1; j < first.length; j++) {
        const a = first[i]
        const b = first[j]
        const overlapX =
          a.position.x < b.position.x + CARD_WIDTH && b.position.x < a.position.x + CARD_WIDTH
        const overlapY =
          a.position.y < b.position.y + CARD_HEIGHT && b.position.y < a.position.y + CARD_HEIGHT
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })

  it('lays out import cycles without crashing', async () => {
    const { nodes, edges } = projectGraph(cycleGraph, new Set(Object.keys(cycleGraph.nodes)))
    expect(await layout(nodes, edges)).toHaveLength(3)
  })

  it('returns the input unchanged for an empty node set', async () => {
    expect(await layout([], [])).toEqual([])
  })
})
