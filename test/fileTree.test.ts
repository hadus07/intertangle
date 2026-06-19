import { describe, expect, it } from 'vitest'
import { buildTree, descendantFiles } from '../web/src/lib/treeBuilder.js'

describe('buildTree', () => {
  it('nests files under synthesized folders', () => {
    const tree = buildTree(['src/a.ts', 'src/sub/b.ts', 'index.ts'])

    // folders before files, each alpha
    expect(tree.map(n => [n.name, n.isFile])).toEqual([
      ['src', false],
      ['index.ts', true],
    ])
    const src = tree[0]
    expect(src.path).toBe('src')
    expect(src.children.map(n => [n.name, n.isFile, n.path])).toEqual([
      ['sub', false, 'src/sub'],
      ['a.ts', true, 'src/a.ts'],
    ])
    expect(src.children[0].children).toEqual([
      { name: 'b.ts', path: 'src/sub/b.ts', isFile: true, children: [] },
    ])
  })

  it('collapses single-child folder chains into one item', () => {
    const tree = buildTree(['src/shared/graph.ts', 'src/shared/canvas.ts'])
    expect(tree.length).toBe(1)
    expect([tree[0].name, tree[0].path]).toEqual(['src/shared', 'src/shared'])
    expect(tree[0].children.map(n => n.name)).toEqual(['canvas.ts', 'graph.ts'])
  })

  it('lists every file under a folder, recursively', () => {
    const tree = buildTree(['src/a.ts', 'src/sub/b.ts', 'src/sub/deep/c.ts'])
    expect(descendantFiles(tree[0]).sort()).toEqual([
      'src/a.ts',
      'src/sub/b.ts',
      'src/sub/deep/c.ts',
    ])
  })
})
