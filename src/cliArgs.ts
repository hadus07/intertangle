import fs from 'node:fs'
import path from 'node:path'

const PROJECT_MARKERS = ['package.json', /^tsconfig.*\.json$/]

export function findProjectRoot(from: string): string {
  let current = path.resolve(from)
  while (true) {
    const entries = fs.readdirSync(current)
    if (
      PROJECT_MARKERS.some(marker =>
        typeof marker === 'string' ? entries.includes(marker) : entries.some(e => marker.test(e)),
      )
    ) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return from
}

export function parseRootArg(args: string[], cwd: string): { root: string; scopeArgs: string[] } {
  const first = args[0]
  if (!first) return { root: findProjectRoot(cwd), scopeArgs: args }
  const resolved = path.resolve(cwd, first)
  try {
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) return { root: resolved, scopeArgs: args.slice(1) }
    const dir = path.dirname(resolved)
    return { root: dir, scopeArgs: [path.relative(dir, resolved), ...args.slice(1)] }
  } catch {
    return { root: findProjectRoot(cwd), scopeArgs: args }
  }
}
