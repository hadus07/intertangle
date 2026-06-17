import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import open from 'open'
import { getSingletonHighlighter } from 'shiki'
import type { Graph } from './shared/graph.js'

// The one real security boundary: confine a request path to inside `root`.
// Returns the resolved real path, or null if it escapes (reject as 403).
export async function resolveInside(root: string, decodedPath: string): Promise<string | null> {
  if (path.isAbsolute(decodedPath)) return null
  const rootResolved = path.resolve(root)
  const requested = path.resolve(rootResolved, decodedPath)
  if (requested !== rootResolved && !requested.startsWith(rootResolved + path.sep)) return null
  const real = await fs.realpath(requested).catch(() => requested)
  if (real !== rootResolved && !real.startsWith(rootResolved + path.sep)) return null
  return real
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
  themes: ['github-dark'],
})

// Read a project file live and return server-side Shiki-highlighted HTML.
// Shared by the production server and the dev Vite plugin.
export async function highlightFile(absPath: string): Promise<string> {
  const source = await fs.readFile(absPath, 'utf8')
  const lang = EXT_TO_LANG[path.extname(absPath).toLowerCase()] ?? 'typescript'
  const highlighter = await highlighterPromise
  return highlighter.codeToHtml(source, { lang, theme: 'github-dark' })
}

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

    if (url.pathname === '/open' && req.method === 'GET') {
      const decodedPath = decodeURIComponent(url.searchParams.get('path') ?? '')
      const real = await resolveInside(graph.root, decodedPath)
      if (!real) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }
      try {
        // ponytail: opens in the OS default app for the file type; if that's not
        // the user's editor, this is where an explicit `code`/$EDITOR call goes.
        await open(real)
        res.writeHead(204)
        res.end()
      } catch {
        res.writeHead(500)
        res.end('Failed to open')
      }
      return
    }

    if (url.pathname === '/file' && req.method === 'GET') {
      const rawPath = url.searchParams.get('path') ?? ''
      const decodedPath = decodeURIComponent(rawPath)

      const real = await resolveInside(graph.root, decodedPath)
      if (!real) {
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

        const html = await highlightFile(real)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }

      return
    }

    const rawPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const target = await resolveInside(webRoot, rawPath.replace(/^\/+/, ''))

    if (!target) {
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

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
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
