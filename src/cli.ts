import path from 'node:path'
import process from 'node:process'
import open from 'open'
import { buildGraph } from './buildGraph.js'
import { startServer } from './server.js'

async function main() {
  const cwd = process.cwd()
  const root = process.env.INTERWEAVE_ROOT ?? cwd
  const argv = process.argv.slice(2)

  const tsconfigIdx = argv.indexOf('--tsconfig')
  const tsconfig = tsconfigIdx !== -1 ? argv[tsconfigIdx + 1] : undefined
  const args =
    tsconfigIdx === -1 ? argv : argv.filter((_, i) => i !== tsconfigIdx && i !== tsconfigIdx + 1)

  const graph = await buildGraph(root, tsconfig)

  const scope = args
    .map((arg) => path.relative(root, path.resolve(root, arg)))
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => !p.startsWith('../') && p.length > 0)

  // File args auto-open as cards; folder args only scope the tree/palette.
  const validSeeds = scope.filter((p) => graph.nodes[p])
  const allPaths = Object.keys(graph.nodes)
  const inScope = (p: string) => graph.nodes[p] || allPaths.some((n) => n.startsWith(`${p}/`))
  for (const p of scope.filter((p) => !inScope(p))) {
    console.warn(`Warning: argument not found in graph: ${p}`)
  }

  // Fixed default port keeps a stable origin so the browser's localStorage
  // (sidebar width, deselected files) survives CLI restarts.
  const portEnv = process.env.INTERWEAVE_PORT
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
  if (!process.env.INTERWEAVE_NO_OPEN) {
    await open(url.toString())
  }

  const shutdown = async () => {
    await close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
