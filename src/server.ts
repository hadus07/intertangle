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

// Both themes are baked into every response as CSS variables (--shiki-light /
// --shiki-dark). styles.css picks which set is active off [data-theme], so a UI
// theme flip is instant and the per-path HTML cache stays valid — no refetch.
const SHIKI_THEMES = { light: 'github-light', dark: 'github-dark' } as const

const highlighterPromise = getSingletonHighlighter({
  langs: ['typescript', 'javascript', 'tsx', 'jsx'],
  themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
})

// Read a project file live and return server-side Shiki-highlighted HTML.
// Shared by the production server and the dev Vite plugin.
export async function highlightFile(absPath: string): Promise<string> {
  const source = await fs.readFile(absPath, 'utf8')
  const lang = EXT_TO_LANG[path.extname(absPath).toLowerCase()] ?? 'typescript'
  const highlighter = await highlighterPromise
  return highlighter.codeToHtml(source, { lang, themes: SHIKI_THEMES, defaultColor: false })
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

async function handleGraph(graph: Graph, res: http.ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(graph))
}

// Parse ?path=, confine it inside root. Writes the 400/403 itself and returns
// null on failure; an empty path is rejected so `open()` can't target the dir.
async function resolveParam(
  graph: Graph,
  url: URL,
  res: http.ServerResponse,
): Promise<string | null> {
  const raw = url.searchParams.get('path')
  if (!raw) {
    res.writeHead(400)
    res.end('Bad request')
    return null
  }
  const real = await resolveInside(graph.root, decodeURIComponent(raw))
  if (!real) {
    res.writeHead(403)
    res.end('Forbidden')
    return null
  }
  return real
}

async function handleOpen(graph: Graph, url: URL, res: http.ServerResponse) {
  const real = await resolveParam(graph, url, res)
  if (!real) return
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
}

async function handleFile(graph: Graph, url: URL, res: http.ServerResponse) {
  const real = await resolveParam(graph, url, res)
  if (!real) return
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
}

async function handleStatic(webRoot: string, assetsUrl: URL, url: URL, res: http.ServerResponse) {
  const rawPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const target = await resolveInside(webRoot, rawPath.replace(/^\/+/, ''))
  if (!target) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  try {
    const data = await fs.readFile(target)
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(target)] ?? 'application/octet-stream',
    })
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
}

async function routeRequest(
  graph: Graph,
  webRoot: string,
  assetsUrl: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/graph' && req.method === 'GET') return handleGraph(graph, res)
  if (url.pathname === '/open' && req.method === 'GET') return handleOpen(graph, url, res)
  if (url.pathname === '/file' && req.method === 'GET') return handleFile(graph, url, res)
  return handleStatic(webRoot, assetsUrl, url, res)
}

export function startServer(
  graph: Graph,
  assetsUrl: URL = defaultAssetsUrl,
  port = 0,
): Promise<ServerHandle> {
  const webRoot = fileURLToPath(assetsUrl)

  const server = http.createServer((req, res) => routeRequest(graph, webRoot, assetsUrl, req, res))

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
