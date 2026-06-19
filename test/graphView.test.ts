import { describe, expect, it } from 'vitest'
import type { Graph } from '../src/shared/graph.js'
import { type GraphViewState, graphView } from '../web/src/lib/graphView.js'

const graph: Graph = {
  root: '/x',
  nodes: {
    'a.ts': { path: 'a.ts', name: 'a.ts' },
    'b.ts': { path: 'b.ts', name: 'b.ts' },
    'c.ts': { path: 'c.ts', name: 'c.ts' },
  },
  forward: { 'a.ts': ['b.ts', 'c.ts'], 'b.ts': ['c.ts'], 'c.ts': [] },
  reverse: { 'a.ts': [], 'b.ts': ['a.ts'], 'c.ts': ['a.ts', 'b.ts'] },
  external: {},
}

const blank = (over: Partial<GraphViewState> = {}): GraphViewState => ({
  expanded: new Set(),
  excluded: new Set(),
  sourcePath: null,
  ...over,
})

describe('graphView', () => {
  it('expand imports adds forward targets, skipping excluded', () => {
    const s = graphView(
      graph,
      blank({ expanded: new Set(['a.ts']), excluded: new Set(['c.ts']) }),
      {
        type: 'expand',
        path: 'a.ts',
        direction: 'imports',
      },
    )
    expect([...s.expanded].sort()).toEqual(['a.ts', 'b.ts'])
  })

  it('expand importedBy adds reverse targets', () => {
    const s = graphView(graph, blank({ expanded: new Set(['c.ts']) }), {
      type: 'expand',
      path: 'c.ts',
      direction: 'importedBy',
    })
    expect([...s.expanded].sort()).toEqual(['a.ts', 'b.ts', 'c.ts'])
  })

  it('expand is idempotent (union, never drops)', () => {
    const start = blank({ expanded: new Set(['a.ts', 'b.ts', 'c.ts']) })
    const s = graphView(graph, start, { type: 'expand', path: 'a.ts', direction: 'imports' })
    expect([...s.expanded].sort()).toEqual(['a.ts', 'b.ts', 'c.ts'])
  })

  it('setExcluded stores the precomputed set', () => {
    const added = graphView(graph, blank(), {
      type: 'setExcluded',
      excluded: new Set(['a.ts', 'b.ts']),
    })
    expect([...added.excluded].sort()).toEqual(['a.ts', 'b.ts'])
    const removed = graphView(graph, added, {
      type: 'setExcluded',
      excluded: new Set(['b.ts']),
    })
    expect([...removed.excluded]).toEqual(['b.ts'])
  })

  it('remove drops from expanded and clears sourcePath iff equal', () => {
    const s = graphView(graph, blank({ expanded: new Set(['a.ts', 'b.ts']), sourcePath: 'a.ts' }), {
      type: 'remove',
      path: 'a.ts',
    })
    expect([...s.expanded]).toEqual(['b.ts'])
    expect(s.sourcePath).toBeNull()
  })

  it('remove leaves an unrelated sourcePath intact', () => {
    const s = graphView(graph, blank({ expanded: new Set(['a.ts', 'b.ts']), sourcePath: 'b.ts' }), {
      type: 'remove',
      path: 'a.ts',
    })
    expect(s.sourcePath).toBe('b.ts')
  })

  it('seed adds a single path to expanded', () => {
    const s = graphView(graph, blank(), { type: 'seed', path: 'b.ts' })
    expect([...s.expanded]).toEqual(['b.ts'])
  })

  it('seed is idempotent on an already-expanded path', () => {
    const s = graphView(graph, blank({ expanded: new Set(['b.ts']) }), {
      type: 'seed',
      path: 'b.ts',
    })
    expect([...s.expanded]).toEqual(['b.ts'])
  })

  it('clear empties expanded + sourcePath but keeps excluded', () => {
    const s = graphView(
      graph,
      blank({ expanded: new Set(['a.ts']), excluded: new Set(['b.ts']), sourcePath: 'a.ts' }),
      { type: 'clear' },
    )
    expect(s.expanded.size).toBe(0)
    expect(s.sourcePath).toBeNull()
    expect([...s.excluded]).toEqual(['b.ts'])
  })

  it('invariant: an expand/setExcluded cycle never removes a member from expanded', () => {
    let s = blank({ expanded: new Set(['a.ts']) })
    s = graphView(graph, s, { type: 'expand', path: 'a.ts', direction: 'imports' })
    s = graphView(graph, s, { type: 'setExcluded', excluded: new Set(['b.ts']) })
    s = graphView(graph, s, { type: 'setExcluded', excluded: new Set() })
    expect(s.expanded.has('a.ts')).toBe(true)
    expect(s.expanded.has('b.ts')).toBe(true)
    expect(s.expanded.has('c.ts')).toBe(true)
  })
})
