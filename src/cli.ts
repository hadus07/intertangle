import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import open from 'open'
import { buildGraph } from './buildGraph.js'
import { startServer } from './server.js'

const PROJECT_MARKERS = ['package.json', /^tsconfig.*\.json$/]

function findProjectRoot(from: string): string {
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

function parseRootArg(args: string[], cwd: string): { root: string; scopeArgs: string[] } {
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

async function main() {
  const cwd = process.cwd()
  const argv = process.argv.slice(2)

  const tsconfigIdx = argv.indexOf('--tsconfig')
  const tsconfig = tsconfigIdx !== -1 ? argv[tsconfigIdx + 1] : undefined
  const args =
    tsconfigIdx === -1 ? argv : argv.filter((_, i) => i !== tsconfigIdx && i !== tsconfigIdx + 1)

  const envRoot = process.env.INTERTANGLE_ROOT
  const { root, scopeArgs } = parseRootArg(args, envRoot ? path.resolve(envRoot) : cwd)

  const graph = await buildGraph(root, tsconfig)

  const scope = scopeArgs
    .map(arg => path.relative(root, path.resolve(root, arg)))
    .map(p => p.replaceAll('\\', '/'))
    .filter(p => !p.startsWith('../') && p.length > 0)

  // File args auto-open as cards; folder args only scope the tree/palette.
  const validSeeds = scope.filter(p => graph.nodes[p])
  const allPaths = Object.keys(graph.nodes)
  const inScope = (p: string) => graph.nodes[p] || allPaths.some(n => n.startsWith(`${p}/`))
  for (const p of scope.filter(p => !inScope(p))) {
    console.warn(`Warning: argument not found in graph: ${p}`)
  }

  // Fixed default port keeps a stable origin so the browser's localStorage
  // (sidebar width, deselected files) survives CLI restarts.
  const portEnv = process.env.INTERTANGLE_PORT
  const preferredPort = portEnv ? Number.parseInt(portEnv, 10) : 31718
  const { port, close } = await startServer(graph, undefined, preferredPort).catch(() =>
    // ponytail: port in use → ephemeral fallback; that session won't persist UI prefs.
    startServer(graph, undefined, 0),
  )

  const url = new URL('/', `http://127.0.0.1:${port}`)
  if (validSeeds.length > 0) {
    url.searchParams.set('seeds', validSeeds.join(','))
  }
  if (scope.length > 0) {
    url.searchParams.set('scope', scope.join(','))
  }
  console.log(`intertangle running at ${url}`)
  if (!process.env.INTERTANGLE_NO_OPEN) {
    await open(url.toString())
  }

  const shutdown = async () => {
    await close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
