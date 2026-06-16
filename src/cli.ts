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
  const args = argv.filter((_, i) => i !== tsconfigIdx && i !== tsconfigIdx + 1)

  const graph = await buildGraph(root, tsconfig)

  const seeds = args
    .map((arg) => path.relative(root, path.resolve(root, arg)))
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => !p.startsWith('../') && p.length > 0)

  const validSeeds = seeds.filter((p) => graph.nodes[p])
  const missing = seeds.filter((p) => !graph.nodes[p])
  for (const p of missing) {
    console.warn(`Warning: seed not found in graph: ${p}`)
  }

  const portEnv = process.env.INTERWEAVE_PORT
  const preferredPort = portEnv ? Number.parseInt(portEnv, 10) : 0
  const { port, close } = await startServer(graph, undefined, preferredPort)

  const url = new URL('/', `http://127.0.0.1:${port}`)
  if (validSeeds.length > 0) {
    url.searchParams.set('seeds', validSeeds.join(','))
  }
  console.log(`interweave running at ${url}`)
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
