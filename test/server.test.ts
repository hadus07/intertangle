import { afterAll, describe, expect, it } from 'vitest'
import { buildGraph } from '../src/buildGraph.js'
import { startServer } from '../src/server.js'
import { fixtureRoot } from './helpers.js'

const root = fixtureRoot('relative-imports')
const builtAssets = new URL('../dist/web/', import.meta.url)

describe('server', () => {
  let handle: import('../src/server.js').ServerHandle

  it('serves /graph matching buildGraph', async () => {
    const graph = await buildGraph(root)
    handle = await startServer(graph, builtAssets)

    const res = await fetch(`http://127.0.0.1:${handle.port}/graph`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(graph)
  })

  it('serves the prebuilt frontend', async () => {
    // Server tests rely on a prior build; verify the asset exists.
    const res = await fetch(`http://127.0.0.1:${handle.port}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('highlights an in-project source file at /file', async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/file?path=src%2Findex.ts`)
    const body = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('shiki')
    expect(body).toContain('export')
  })

  it('rejects path traversal at /file', async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/file?path=..%2Fpackage.json`)
    expect(res.status).toBe(403)
  })

  it('rejects missing, empty, or absolute path at /file with 400', async () => {
    const missing = await fetch(`http://127.0.0.1:${handle.port}/file`)
    expect(missing.status).toBe(400)
    const empty = await fetch(`http://127.0.0.1:${handle.port}/file?path=`)
    expect(empty.status).toBe(400)
    const absolute = await fetch(`http://127.0.0.1:${handle.port}/file?path=%2Fetc%2Fpasswd`)
    expect(absolute.status).toBe(400)
  })

  it('rejects path traversal at /open', async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/open?path=..%2Fpackage.json`)
    expect(res.status).toBe(403)
  })

  it('rejects missing, empty, or absolute path at /open with 400', async () => {
    const missing = await fetch(`http://127.0.0.1:${handle.port}/open`)
    expect(missing.status).toBe(400)
    const empty = await fetch(`http://127.0.0.1:${handle.port}/open?path=`)
    expect(empty.status).toBe(400)
    const absolute = await fetch(`http://127.0.0.1:${handle.port}/open?path=%2Fetc%2Fpasswd`)
    expect(absolute.status).toBe(400)
  })

  afterAll(async () => {
    await handle?.close()
  })
})
