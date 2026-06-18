import fs from 'node:fs'
import path from 'node:path'
import { type ICruiseOptions, cruise } from 'dependency-cruiser'
import ignore from 'ignore'
import JSON5 from 'json5'
import type { ExternalLabel, ExternalLabelType, Graph } from './shared/graph.js'

const LOCAL_TYPES = new Set(['local', 'localmodule'])
const GITIGNORED_DIRS = new Set(['node_modules', '.git'])

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

function loadAncestorGitignores(scanRoot: string, repoRoot: string): IgnoreMap {
  const ignores: IgnoreMap = new Map()
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
  return ignores
}

function walkDescendantGitignores(dir: string, repoRoot: string, ignores: IgnoreMap) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || GITIGNORED_DIRS.has(entry.name)) continue
    const childDir = path.join(dir, entry.name)
    if (fs.existsSync(path.join(childDir, '.gitignore'))) {
      const dirRel = path.relative(repoRoot, childDir).replaceAll('\\', '/')
      ignores.set(dirRel, ignore().add(fs.readFileSync(path.join(childDir, '.gitignore'), 'utf8')))
    }
    walkDescendantGitignores(childDir, repoRoot, ignores)
  }
}

function loadDescendantGitignores(scanRoot: string, repoRoot: string): IgnoreMap {
  const ignores: IgnoreMap = new Map()
  walkDescendantGitignores(path.resolve(scanRoot), repoRoot, ignores)
  return ignores
}

function matchesIgnoreEntry(
  repoRelFile: string,
  dirRel: string,
  ignorer: ReturnType<typeof ignore>,
): boolean {
  if (dirRel !== '' && !repoRelFile.startsWith(`${dirRel}/`) && repoRelFile !== dirRel) return false
  const rel = dirRel === '' ? repoRelFile : repoRelFile.slice(dirRel.length + 1)
  return ignorer.ignores(rel)
}

function isIgnored(projectRelativePath: string, scanRootRel: string, ignores: IgnoreMap): boolean {
  const repoRelFile = scanRootRel ? `${scanRootRel}/${projectRelativePath}` : projectRelativePath
  for (const [dirRel, ignorer] of ignores) {
    if (matchesIgnoreEntry(repoRelFile, dirRel, ignorer)) return true
  }
  return false
}

function addDependencyToGraph(
  graph: Graph,
  dep: unknown,
  source: string,
  absoluteRoot: string,
  scanRootRel: string,
  ignores: IgnoreMap,
) {
  const depModule = (dep as { module?: string }).module ?? ''
  const depResolved = (dep as { resolved?: string }).resolved ?? depModule
  const types = ((dep as { dependencyTypes?: string[] }).dependencyTypes ?? []).filter(
    (t): t is string => typeof t === 'string',
  )
  if (isLocal(types, depResolved, absoluteRoot)) {
    const target = toProjectRelative(depResolved, absoluteRoot)
    if (target && target !== source && !isIgnored(target, scanRootRel, ignores))
      graph.forward[source].push(target)
  } else {
    graph.external[source].push({ name: depModule, type: classifyExternal(types) })
  }
}

function addModuleToGraph(
  graph: Graph,
  mod: unknown,
  absoluteRoot: string,
  scanRootRel: string,
  ignores: IgnoreMap,
) {
  const modulePath = (mod as { source?: string }).source
  if (!modulePath || typeof modulePath !== 'string') return
  const source = toProjectRelative(modulePath, absoluteRoot)
  if (
    !source ||
    isIgnored(source, scanRootRel, ignores) ||
    !isProjectFile(modulePath, absoluteRoot)
  )
    return
  graph.nodes[source] = { path: source, name: path.posix.basename(source) }
  graph.forward[source] = []
  graph.external[source] = []
  for (const dep of (mod as { dependencies?: unknown[] }).dependencies ?? [])
    addDependencyToGraph(graph, dep, source, absoluteRoot, scanRootRel, ignores)
  graph.forward[source] = sortedUnique(graph.forward[source])
  graph.external[source] = uniqueLabels(graph.external[source])
}

function buildReverseIndex(forward: Record<string, string[]>): Record<string, string[]> {
  const reverse: Record<string, string[]> = {}
  for (const source of Object.keys(forward)) reverse[source] = []
  for (const [source, targets] of Object.entries(forward)) {
    for (const target of targets) {
      if (!reverse[target]) reverse[target] = []
      reverse[target].push(source)
    }
  }
  for (const source of Object.keys(reverse)) {
    reverse[source] = sortedUnique(reverse[source])
  }
  return reverse
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

  const repoRoot = findGitRepoRoot(absoluteRoot)
  const ignores: IgnoreMap = new Map([
    ...loadAncestorGitignores(absoluteRoot, repoRoot),
    ...loadDescendantGitignores(absoluteRoot, repoRoot),
  ])
  const scanRootRel = path.relative(repoRoot, absoluteRoot).replaceAll('\\', '/') || ''

  for (const mod of modules) addModuleToGraph(graph, mod, absoluteRoot, scanRootRel, ignores)

  graph.reverse = buildReverseIndex(graph.forward)

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

function findTsconfigs(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) findTsconfigs(path.join(dir, entry.name), acc)
    } else if (/^tsconfig.*\.json$/.test(entry.name)) {
      acc.push(path.join(dir, entry.name))
    }
  }
  return acc
}

function tsconfigAlias(tsconfigPath: string): Record<string, string> {
  try {
    const tsconfigJson = JSON5.parse(fs.readFileSync(tsconfigPath, 'utf8')) as {
      compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string }
    }
    const paths = tsconfigJson.compilerOptions?.paths ?? {}
    const baseUrl = tsconfigJson.compilerOptions?.baseUrl ?? '.'
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
