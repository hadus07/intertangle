import { describe, expect, it } from 'vitest'
import { buildGraph } from '../src/buildGraph.js'
import { fixtureRoot } from './helpers.js'

describe('buildGraph', () => {
  it('finds forward edges for relative imports', async () => {
    const graph = await buildGraph(fixtureRoot('relative-imports'))

    expect(Object.keys(graph.nodes).sort()).toEqual([
      'src/index.ts',
      'src/types.ts',
      'src/utils.ts',
    ])
    expect(graph.forward['src/index.ts']).toEqual(['src/types.ts', 'src/utils.ts'])
    expect(graph.forward['src/utils.ts']).toEqual(['src/types.ts'])
    expect(graph.forward['src/types.ts']).toEqual([])
    expect(graph.reverse['src/types.ts']).toEqual(['src/index.ts', 'src/utils.ts'])
    expect(graph.reverse['src/utils.ts']).toEqual(['src/index.ts'])
    expect(graph.reverse['src/index.ts']).toEqual([])
    expect(graph.external['src/index.ts']).toEqual([])
    expect(graph.external['src/utils.ts']).toEqual([])
  })

  it('labels external imports by type and skips node_modules', async () => {
    const graph = await buildGraph(fixtureRoot('external-deps'))

    expect(Object.keys(graph.nodes).sort()).toEqual(['src/index.ts', 'src/utils.ts'])
    expect(graph.forward['src/index.ts']).toEqual(['src/utils.ts'])
    expect(graph.external['src/index.ts']).toEqual(
      expect.arrayContaining([
        { name: 'fs', type: 'core' },
        { name: 'react', type: 'npm' },
      ]),
    )
    expect(graph.external['src/utils.ts']).toContainEqual({ name: 'lodash', type: 'unresolved' })
    expect(Object.keys(graph.nodes).some((p) => p.includes('node_modules'))).toBe(false)
    expect(Object.keys(graph.nodes)).not.toContain('fs')
    expect(Object.keys(graph.nodes)).not.toContain('lodash')
  })

  it('resolves path aliases when root tsconfig.json has paths', async () => {
    const graph = await buildGraph(fixtureRoot('ts-aliases'))

    expect(Object.keys(graph.nodes).sort()).toEqual(['src/index.ts', 'src/utils.ts'])
    expect(graph.forward['src/index.ts']).toEqual(['src/utils.ts'])
  })

  it('resolves path aliases when --tsconfig override is given', async () => {
    const root = fixtureRoot('ts-aliases')
    const graph = await buildGraph(root, `${root}/tsconfig.json`)

    expect(graph.forward['src/index.ts']).toEqual(['src/utils.ts'])
  })

  it('runs without error and resolves relative imports when no tsconfig exists', async () => {
    const graph = await buildGraph(fixtureRoot('relative-imports'), undefined)

    expect(Object.keys(graph.nodes).sort()).toEqual([
      'src/index.ts',
      'src/types.ts',
      'src/utils.ts',
    ])
    expect(graph.forward['src/index.ts']).toEqual(['src/types.ts', 'src/utils.ts'])
  })

  it('renders import cycles without dropping edges', async () => {
    const graph = await buildGraph(fixtureRoot('cycle'))

    expect(Object.keys(graph.nodes).sort()).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
    expect(graph.forward['src/a.ts']).toEqual(['src/b.ts'])
    expect(graph.forward['src/b.ts']).toEqual(['src/c.ts'])
    expect(graph.forward['src/c.ts']).toEqual(['src/a.ts'])
    expect(graph.reverse['src/a.ts']).toEqual(['src/c.ts'])
    expect(graph.reverse['src/b.ts']).toEqual(['src/a.ts'])
    expect(graph.reverse['src/c.ts']).toEqual(['src/b.ts'])
  })
})
