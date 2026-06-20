import fs from 'node:fs'
import path from 'node:path'
import { cruise, type ICruiseOptions } from 'dependency-cruiser'
import ignore from 'ignore'
import JSON5 from 'json5'
import type { ExternalLabel, ExternalLabelType, Graph } from './shared/graph.js'

const LOCAL_TYPES = new Set(['local', 'localmodule'])
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage'])

type IgnoreMap = Map<string, ReturnType<typeof ignore>>

interface CruiseDependency {
  module?: string
  resolved?: string
  dependencyTypes?: string[]
}

interface CruiseModule {
  source?: string
  dependencies?: CruiseDependency[]
}

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

function posixRelative(from: string, to: string): string {
  return path.relative(from, to).replaceAll('\\', '/')
}

function loadAncestorGitignores(scanRoot: string, repoRoot: string): IgnoreMap {
  const ignores: IgnoreMap = new Map()
  let current = path.resolve(scanRoot)
  while (true) {
    const gitignorePath = path.join(current, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const dirRel = posixRelative(repoRoot, current)
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
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue
    const childDir = path.join(dir, entry.name)
    if (fs.existsSync(path.join(childDir, '.gitignore'))) {
      const dirRel = posixRelative(repoRoot, childDir)
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

function loadGitignores(scanRoot: string): { ignores: IgnoreMap; repoRoot: string } {
  const repoRoot = findGitRepoRoot(scanRoot)
  const ignores: IgnoreMap = new Map([
    ...loadAncestorGitignores(scanRoot, repoRoot),
    ...loadDescendantGitignores(scanRoot, repoRoot),
  ])
  return { ignores, repoRoot }
}

function isIgnored(repoRelFile: string, ignores: IgnoreMap): boolean {
  let dirRel = ''
  let remainingRel = repoRelFile
  for (const segment of repoRelFile.split('/')) {
    const ignorer = ignores.get(dirRel)
    if (ignorer?.ignores(remainingRel)) return true
    dirRel = dirRel ? `${dirRel}/${segment}` : segment
    remainingRel = remainingRel.slice(segment.length + 1)
  }
  return false
}

function repoRelative(projectRelative: string, scanRootRel: string): string {
  return scanRootRel ? `${scanRootRel}/${projectRelative}` : projectRelative
}

function resolveLocalTarget(
  dep: CruiseDependency,
  source: string,
  absoluteRoot: string,
  scanRootRel: string,
  ignores: IgnoreMap,
): string | null {
  const resolved = dep.resolved ?? dep.module ?? ''
  const target = toProjectRelative(resolved, absoluteRoot)
  if (!target || target === source) return null
  if (isIgnored(repoRelative(target, scanRootRel), ignores)) return null
  return target
}

function addDependencyToGraph(
  dep: CruiseDependency,
  source: string,
  absoluteRoot: string,
  scanRootRel: string,
  ignores: IgnoreMap,
  forward: Set<string>,
  external: Set<ExternalLabel>,
) {
  const types = dep.dependencyTypes ?? []
  if (!isLocal(types, dep.resolved ?? dep.module ?? '', absoluteRoot)) {
    external.add({ name: dep.module ?? '', type: classifyExternal(types) })
    return
  }
  const target = resolveLocalTarget(dep, source, absoluteRoot, scanRootRel, ignores)
  if (target) forward.add(target)
}

function addModuleToGraph(
  graph: Graph,
  mod: CruiseModule,
  absoluteRoot: string,
  scanRootRel: string,
  ignores: IgnoreMap,
) {
  const source = toProjectRelative(mod.source ?? '', absoluteRoot)
  if (!source) return
  const repoRelFile = scanRootRel ? `${scanRootRel}/${source}` : source
  if (isIgnored(repoRelFile, ignores) || !isProjectFile(mod.source ?? '', absoluteRoot)) return
  const forward = new Set<string>()
  const external = new Set<ExternalLabel>()
  for (const dep of mod.dependencies ?? [])
    addDependencyToGraph(dep, source, absoluteRoot, scanRootRel, ignores, forward, external)
  graph.nodes[source] = { path: source, name: path.posix.basename(source) }
  graph.forward[source] = [...forward].sort()
  graph.external[source] = uniqueLabels([...external])
}

function buildReverseIndex(forward: Record<string, string[]>): Record<string, string[]> {
  const reverse: Record<string, Set<string>> = {}
  for (const source of Object.keys(forward)) reverse[source] = new Set()
  for (const [source, targets] of Object.entries(forward)) {
    for (const target of targets) reverse[target].add(source)
  }
  const result: Record<string, string[]> = {}
  for (const [source, sources] of Object.entries(reverse)) {
    result[source] = [...sources].sort()
  }
  return result
}

function resolveAliases(absoluteRoot: string, tsconfig?: string): Record<string, string> {
  const tsconfigs = tsconfig ? [tsconfig] : findTsconfigs(absoluteRoot)
  return Object.assign({}, ...tsconfigs.map(tsconfigAlias))
}

function buildCruiseOptions(absoluteRoot: string, alias: Record<string, string>): ICruiseOptions {
  return {
    baseDir: absoluteRoot,
    outputType: 'json',
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'core'],
    },
    moduleSystems: ['es6', 'cjs'],
    combinedDependencies: true,
    tsPreCompilationDeps: true,
    // enhancedResolveOptions.alias works at runtime but isn't in dependency-cruiser's
    // types yet; drop the `as ICruiseOptions` cast once it is.
    ...(Object.keys(alias).length > 0 ? { enhancedResolveOptions: { alias } } : {}),
  } as ICruiseOptions
}

function parseCruiseModules(result: { output: unknown }): CruiseModule[] {
  return (JSON.parse(result.output as string) as { modules?: CruiseModule[] }).modules ?? []
}

function indexModules(
  modules: CruiseModule[],
  absoluteRoot: string,
  scanRootRel: string,
  ignores: IgnoreMap,
): Pick<Graph, 'nodes' | 'forward' | 'external'> {
  const graph: Pick<Graph, 'nodes' | 'forward' | 'external'> = {
    nodes: {},
    forward: {},
    external: {},
  }
  for (const mod of modules) addModuleToGraph(graph, mod, absoluteRoot, scanRootRel, ignores)
  return graph
}

export async function buildGraph(root: string, tsconfig?: string): Promise<Graph> {
  const absoluteRoot = path.resolve(root)

  const { ignores, repoRoot } = loadGitignores(absoluteRoot)
  const alias = resolveAliases(absoluteRoot, tsconfig)
  const scanRootRel = posixRelative(repoRoot, absoluteRoot) || ''

  const options = buildCruiseOptions(absoluteRoot, alias)
  const result = await cruise(['.'], options)
  const modules = parseCruiseModules(result)

  const { nodes, forward, external } = indexModules(modules, absoluteRoot, scanRootRel, ignores)

  return {
    root: absoluteRoot,
    nodes,
    forward,
    reverse: buildReverseIndex(forward),
    external,
  }
}

export function toProjectRelative(filePath: string, root: string): string | null {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath)
  const relative = posixRelative(root, absolute)
  if (relative.startsWith('../')) return null
  return relative
}

function isProjectFile(raw: string, root: string): boolean {
  const relative = toProjectRelative(raw, root)
  if (!relative) return false
  try {
    return fs.statSync(path.resolve(root, relative)).isFile()
  } catch {
    return false
  }
}

function isLocal(types: string[], resolved: string, root: string): boolean {
  if (types.some(t => LOCAL_TYPES.has(t))) return true
  if (types.length > 0) return false
  if (!resolved) return false
  return toProjectRelative(resolved, root) !== null
}

function classifyExternal(types: string[]): ExternalLabelType {
  if (types.includes('core')) return 'core'
  if (types.some(t => t.startsWith('npm'))) return 'npm'
  return 'unresolved'
}

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

function parseJsonOrJson5(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON5.parse(raw)
  }
}

function tsconfigAlias(tsconfigPath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf8')
    const parsed = parseJsonOrJson5(raw) as {
      compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string }
    }
    const paths = parsed.compilerOptions?.paths ?? {}
    const baseUrl = parsed.compilerOptions?.baseUrl ?? '.'
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
