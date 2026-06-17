import fs from 'node:fs'
import path from 'node:path'
import { type ICruiseOptions, cruise } from 'dependency-cruiser'
import type { ExternalLabel, ExternalLabelType, Graph, GraphNode } from './shared/graph.js'

const LOCAL_TYPES = new Set(['local', 'localmodule'])

export async function buildGraph(root: string, tsconfig?: string): Promise<Graph> {
  // Explicit --tsconfig wins; otherwise merge paths from every tsconfig in the
  // project so aliases living in a nested config (e.g. web/tsconfig.json) still
  // resolve to local edges instead of dropping to inert "unresolved" labels.
  const tsconfigs = tsconfig ? [tsconfig] : findTsconfigs(root)
  const alias = Object.assign({}, ...tsconfigs.map(tsconfigAlias))

  const options = {
    baseDir: root,
    outputType: 'json',
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'core'],
    },
    exclude: '(^|/)(dist|\\.git|coverage)(/|$)',
    moduleSystems: ['es6', 'cjs'],
    combinedDependencies: true,
    tsPreCompilationDeps: true,
    // ponytail: alias not in dep-cruiser types but supported at runtime
    ...(Object.keys(alias).length > 0 ? { enhancedResolveOptions: { alias } } : {}),
  } as ICruiseOptions

  const result = await cruise(['.'], options)
  const modules = (JSON.parse(result.output as string) as { modules?: unknown[] }).modules ?? []

  const graph: Graph = {
    root,
    nodes: {},
    forward: {},
    reverse: {},
    external: {},
  }

  for (const mod of modules) {
    const raw = (mod as { source?: string }).source
    if (!raw || typeof raw !== 'string') continue
    const source = toProjectRelative(raw, root)
    if (!source) continue
    // doNotFollow reports node_modules deps (so they can be labeled external) but
    // doesn't crawl them; they still surface as modules. Never make them nodes.
    if (`/${source}`.includes('/node_modules/')) continue
    if (!isProjectFile(raw, root)) continue

    const node: GraphNode = {
      path: source,
      name: path.posix.basename(source),
    }
    graph.nodes[source] = node
    graph.forward[source] = []
    graph.reverse[source] = []
    graph.external[source] = []

    const deps = (mod as { dependencies?: unknown[] }).dependencies ?? []
    for (const dep of deps) {
      const depModule = (dep as { module?: string }).module ?? ''
      const depResolved = (dep as { resolved?: string }).resolved ?? depModule
      const types = ((dep as { dependencyTypes?: string[] }).dependencyTypes ?? []).filter(
        (t): t is string => typeof t === 'string',
      )

      if (isLocal(types, depResolved, root)) {
        const target = toProjectRelative(depResolved, root)
        if (
          target &&
          target !== source &&
          !target.startsWith('node_modules/') &&
          !target.startsWith('../')
        ) {
          graph.forward[source].push(target)
        }
      } else {
        graph.external[source].push({ name: depModule, type: classifyExternal(types) })
      }
    }

    graph.forward[source] = sortedUnique(graph.forward[source])
    graph.external[source] = uniqueLabels(graph.external[source])
  }

  for (const [source, targets] of Object.entries(graph.forward)) {
    for (const target of targets) {
      graph.reverse[target].push(source)
    }
  }
  for (const source of Object.keys(graph.reverse)) {
    graph.reverse[source] = sortedUnique(graph.reverse[source])
  }

  return graph
}

function toProjectRelative(filePath: string, root: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath)
  let relative = path.relative(path.resolve(root), absolute)
  relative = relative.replaceAll('\\', '/')
  if (relative.startsWith('../')) return ''
  return relative
}

function isProjectFile(raw: string, root: string): boolean {
  const absolute = path.isAbsolute(raw) ? raw : path.resolve(root, raw)
  try {
    return fs.statSync(absolute).isFile()
  } catch {
    return false
  }
}

function isLocal(types: string[], resolved: string, root: string): boolean {
  if (types.some((t) => LOCAL_TYPES.has(t))) return true
  if (types.length > 0) return false
  if (!resolved) return false
  const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(root, resolved)
  const relative = path.relative(path.resolve(root), absolute)
  return !relative.startsWith('..') && !relative.startsWith('node_modules')
}

function classifyExternal(types: string[]): ExternalLabelType {
  if (types.includes('core')) return 'core'
  if (types.some((t) => t.startsWith('npm'))) return 'npm'
  return 'unresolved'
}

function sortedUnique(arr: string[]): string[] {
  return [...new Set(arr)].sort()
}

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])

function findTsconfigs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) findTsconfigs(path.join(dir, entry.name), out)
    } else if (/^tsconfig.*\.json$/.test(entry.name)) {
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

function tsconfigAlias(tsconfigPath: string): Record<string, string> {
  try {
    // ponytail: strip // line comments so JSONC tsconfigs parse cleanly
    const raw = fs.readFileSync(tsconfigPath, 'utf8').replace(/\/\/[^\n]*/g, '')
    const tc = JSON.parse(raw) as { compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string } }
    const paths = tc.compilerOptions?.paths ?? {}
    const baseUrl = tc.compilerOptions?.baseUrl ?? '.'
    const dir = path.dirname(tsconfigPath)
    const alias: Record<string, string> = {}
    for (const [key, vals] of Object.entries(paths)) {
      if (!vals[0]) continue
      alias[key.replace(/\/\*$/, '')] = path.resolve(dir, baseUrl, vals[0].replace(/\/\*$/, ''))
    }
    return alias
  } catch {
    return {}
  }
}

function uniqueLabels(arr: ExternalLabel[]): ExternalLabel[] {
  const seen = new Set<string>()
  const out: ExternalLabel[] = []
  for (const label of arr) {
    const key = `${label.type}:${label.name}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}
