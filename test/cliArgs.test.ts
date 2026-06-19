import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findProjectRoot, parseRootArg } from '../src/cliArgs.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('findProjectRoot', () => {
  it('returns the dir when it already has package.json', () => {
    expect(findProjectRoot(repoRoot)).toBe(repoRoot)
  })

  it('walks up from a subdirectory to find package.json', () => {
    expect(findProjectRoot(path.join(repoRoot, 'src'))).toBe(repoRoot)
  })

  it('walks up from a deeply nested dir (stops at nearest marker)', () => {
    // web/ has its own tsconfig.json, so the walk stops there, not at repoRoot
    expect(findProjectRoot(path.join(repoRoot, 'web', 'src', 'lib'))).toBe(
      path.join(repoRoot, 'web'),
    )
  })
})

describe('parseRootArg', () => {
  it('no args: root is findProjectRoot(cwd), scopeArgs is empty', () => {
    const result = parseRootArg([], repoRoot)
    expect(result.root).toBe(repoRoot)
    expect(result.scopeArgs).toEqual([])
  })

  it('directory arg: uses it as root, strips from scopeArgs', () => {
    const result = parseRootArg(['src'], repoRoot)
    expect(result.root).toBe(path.join(repoRoot, 'src'))
    expect(result.scopeArgs).toEqual([])
  })

  it('directory arg with trailing scope args', () => {
    const result = parseRootArg(['src', 'cli.ts'], repoRoot)
    expect(result.root).toBe(path.join(repoRoot, 'src'))
    expect(result.scopeArgs).toEqual(['cli.ts'])
  })

  it('file arg: uses parent dir as root, relativises the file', () => {
    const result = parseRootArg(['src/cli.ts'], repoRoot)
    expect(result.root).toBe(path.join(repoRoot, 'src'))
    expect(result.scopeArgs).toEqual(['cli.ts'])
  })

  it('nonexistent arg: falls back to findProjectRoot(cwd), passes arg through', () => {
    const result = parseRootArg(['nonexistent-xyz-abc'], repoRoot)
    expect(result.root).toBe(repoRoot)
    expect(result.scopeArgs).toEqual(['nonexistent-xyz-abc'])
  })
})
