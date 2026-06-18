import fs from 'node:fs'
import path from 'node:path'
import { type ICruiseOptions, cruise } from 'dependency-cruiser'
import ignore from 'ignore'
import JSON5 from 'json5'
import type { ExternalLabel, ExternalLabelType, Graph, GraphNode } from './shared/graph.js'

const LOCAL_TYPES = new Set(['local', 'localmodule'])

type IgnoreMap = Map<string, ReturnType<typeof ignore>>

function findGitRepoRoot(dir: string): string {
  let current = path.resolve(dir)
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return current
}

function loadGitignores(scanRoot: string): IgnoreMap {
  const repoRoot = findGitRepoRoot(scanRoot)
  const ignores: IgnoreMap = new Map()

  // .gitignore files from scan root up to the repo root apply to the scan.
  let current = path.resolve(scanRoot)
  while (true) {
    const gitignorePath = path.join(current, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const dirRel = path.relative(repoRoot, current).replaceAll('\\', '/')
      ignores.set(dirRel || '', ignore().add(fs.readFileSync(gitignorePath, 'utf8')))
    }
    if (current === repoRoot) break
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  // Nested .gitignore files under the scan root refine the rules for subtrees.
  const GITIGNORED_DIRS = new Set(['node_modules', '.git'])
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (GITIGNORED_DIRS.has(entry.name)) continue
      const childDir = path.join(dir, entry.name)
      const gitignorePath = path.join(childDir, '.gitignore')
      if (fs.existsSync(gitignorePath)) {
        const dirRel = path.relative(repoRoot, childDir).replaceAll('\\', '/')
        ignores.set(dirRel, ignore().add(fs.readFileSync(gitignorePath, 'utf8')))
      }
      walk(childDir)
    }
  }
  walk(path.resolve(scanRoot))

  return ignores
}

function isIgnored(projectRelativePath: string, scanRootRel: string, ignores: IgnoreMap): boolean {
  const repoRelFile = scanRootRel ? `${scanRootRel}/${projectRelativePath}` : projectRelativePath
  for (const [dirRel, ig] of ignores) {
    if (dirRel !== '' && !repoRelFile.startsWith(`${dirRel}/`) && repoRelFile !== dirRel) {
      continue
    }
    const rel = dirRel === '' ? repoRelFile : repoRelFile.slice(dirRel.length + 1)
    if (ig.ignores(rel)) return true
  }
  return false
}

export async function buildGraph(root: string, tsconfig?: string): Promise<Graph> {
  const absoluteRoot = path.resolve(root)

  // Explicit --tsconfig wins; otherwise merge paths from every tsconfig in the
  // project so aliases living in a nested config (e.g. web/tsconfig.json) still
  // resolve to local edges instead of dropping to inert "unresolved" labels.
  const tsconfigs = tsconfig ? [tsconfig] : findTsconfigs(absoluteRoot)
  const alias = Object.assign({}, ...tsconfigs.map(tsconfigAlias))

  const options = {
    baseDir: absoluteRoot,
    outputType: 'json',
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'core'],
    },
    moduleSystems: ['es6', 'cjs'],
    combinedDependencies: true,
    tsPreCompilationDeps: true,
    // ponytail: enhancedResolveOptions.alias works at runtime but isn't in
    // dep-cruiser's types yet; drop the `as ICruiseOptions` cast once it is.
    ...(Object.keys(alias).length > 0 ? { enhancedResolveOptions: { alias } } : {}),
  } as ICruiseOptions

  const result = await cruise(['.'], options)
  const modules = (JSON.parse(result.output as string) as { modules?: unknown[] }).modules ?? []

  const graph: Graph = {
    root: absoluteRoot,
    nodes: {},
    forward: {},
    reverse: {},
    external: {},
  }

  const ignores = loadGitignores(absoluteRoot)
  const repoRoot = findGitRepoRoot(absoluteRoot)
  const scanRootRel = path.relative(repoRoot, absoluteRoot).replaceAll('\\', '/') || ''

  for (const mod of modules) {
    const raw = (mod as { source?: string }).source
    if (!raw || typeof raw !== 'string') continue
    const source = toProjectRelative(raw, absoluteRoot)
    if (!source) continue
    if (isIgnored(source, scanRootRel, ignores)) continue
    if (!isProjectFile(raw, absoluteRoot)) continue

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

      if (isLocal(types, depResolved, absoluteRoot)) {
        const target = toProjectRelative(depResolved, absoluteRoot)
        if (target && target !== source && !isIgnored(target, scanRootRel, ignores)) {
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
    const tc = JSON5.parse(fs.readFileSync(tsconfigPath, 'utf8')) as {
      compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string }
    }
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
