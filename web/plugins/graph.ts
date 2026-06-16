import process from 'node:process'
import type { Plugin } from 'vite'
import { buildGraph } from '../../src/buildGraph.js'

export default function graphPlugin(): Plugin {
  const root = process.env.INTERWEAVE_ROOT ?? process.cwd()

  return {
    name: 'interweave-graph',
    configureServer(server) {
      server.middlewares.use('/graph', async (_req, res, next) => {
        try {
          const graph = await buildGraph(root)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(graph))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}
