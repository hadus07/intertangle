import { describe, expect, it } from 'vitest'
import { encodeUrlParams, parseUrlParams } from '../src/shared/urlParams.js'

describe('parseUrlParams', () => {
  it('empty search returns empty seeds and scope', () => {
    const r = parseUrlParams('')
    expect(r.seeds.size).toBe(0)
    expect(r.scope).toEqual([])
  })

  it('parses seeds', () => {
    const r = parseUrlParams('?seeds=src/a.ts,src/b.ts')
    expect(r.seeds).toEqual(new Set(['src/a.ts', 'src/b.ts']))
  })

  it('parses scope', () => {
    const r = parseUrlParams('?scope=src,lib')
    expect(r.scope).toEqual(['src', 'lib'])
  })

  it('parses both together', () => {
    const r = parseUrlParams('?seeds=foo&scope=bar')
    expect(r.seeds).toEqual(new Set(['foo']))
    expect(r.scope).toEqual(['bar'])
  })

  it('filters empty scope segments', () => {
    const r = parseUrlParams('?scope=src,,lib')
    expect(r.scope).toEqual(['src', 'lib'])
  })

  it('missing params return empty values', () => {
    expect(parseUrlParams('?other=x').seeds.size).toBe(0)
    expect(parseUrlParams('?other=x').scope).toEqual([])
  })
})

describe('encodeUrlParams', () => {
  it('empty inputs produce empty params', () => {
    const p = encodeUrlParams(new Set(), [])
    expect(p.toString()).toBe('')
  })

  it('encodes seeds', () => {
    const p = encodeUrlParams(new Set(['src/a.ts', 'src/b.ts']), [])
    const r = parseUrlParams(`?${p.toString()}`)
    expect(r.seeds).toEqual(new Set(['src/a.ts', 'src/b.ts']))
  })

  it('encodes scope', () => {
    const p = encodeUrlParams(new Set(), ['src', 'lib'])
    const r = parseUrlParams(`?${p.toString()}`)
    expect(r.scope).toEqual(['src', 'lib'])
  })

  it('round-trips seeds and scope', () => {
    const seeds = new Set(['foo.ts', 'bar.ts'])
    const scope = ['src', 'lib']
    const r = parseUrlParams(`?${encodeUrlParams(seeds, scope).toString()}`)
    expect(r.seeds).toEqual(seeds)
    expect(r.scope).toEqual(scope)
  })
})
