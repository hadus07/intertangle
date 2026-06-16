import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSingletonHighlighter } from 'shiki'
import type { Graph } from './shared/graph.js'

const defaultAssetsUrl = new URL('./web/', import.meta.url)

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
}

const highlighterPromise = getSingletonHighlighter({
  langs: ['typescript', 'javascript', 'tsx', 'jsx'],
  themes: ['github-light'],
})

export interface ServerHandle {
  port: number
  close(): Promise<void>
}

export function startServer(
  graph: Graph,
  assetsUrl: URL = defaultAssetsUrl,
  port = 0,
): Promise<ServerHandle> {
  const webRoot = fileURLToPath(assetsUrl)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (url.pathname === '/graph' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(graph))
      return
    }

    if (url.pathname === '/file' && req.method === 'GET') {
      const rawPath = url.searchParams.get('path') ?? ''
      const decodedPath = decodeURIComponent(rawPath)

      if (path.isAbsolute(decodedPath)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      const rootResolved = path.resolve(graph.root)
      const requested = path.resolve(rootResolved, decodedPath)
      const isInside = requested === rootResolved || requested.startsWith(rootResolved + path.sep)

      if (!isInside) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      const real = await fs.realpath(requested).catch(() => requested)
      const realInside = real === rootResolved || real.startsWith(rootResolved + path.sep)

      if (!realInside) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      try {
        const stat = await fs.stat(real)
        if (!stat.isFile()) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const source = await fs.readFile(real, 'utf8')
        const ext = path.extname(real).toLowerCase()
        const lang = EXT_TO_LANG[ext] ?? 'typescript'
        const highlighter = await highlighterPromise
        const html = highlighter.codeToHtml(source, { lang, theme: 'github-light' })
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }

      return
    }

    const rawPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const target = path.resolve(webRoot, rawPath.startsWith('/') ? rawPath.slice(1) : rawPath)
    const rootResolved = path.resolve(webRoot)
    const isInside = target === rootResolved || target.startsWith(rootResolved + path.sep)

    if (!isInside) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    try {
      const data = await fs.readFile(target)
      const ext = path.extname(target)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      try {
        const fallback = await fs.readFile(new URL('index.html', assetsUrl))
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fallback)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    }
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        close: () =>
          new Promise<void>((res, rej) => {
            server.closeAllConnections?.()
            server.close((err) => (err ? rej(err) : res()))
          }),
      })
    })
  })
}
