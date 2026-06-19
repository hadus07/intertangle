import { describe, expect, it } from 'vitest'
import { globToRegExp, matchAny } from '../web/src/lib/glob.js'

describe('globToRegExp', () => {
  it('* does not cross /', () => {
    const re = globToRegExp('*.ts')
    expect(re.test('a.ts')).toBe(true)
    expect(re.test('src/a.ts')).toBe(false)
  })

  it('** crosses /', () => {
    const re = globToRegExp('**/*.ts')
    expect(re.test('src/a.ts')).toBe(true)
    expect(re.test('src/deep/a.ts')).toBe(true)
  })

  it('? matches one non-/ char', () => {
    const re = globToRegExp('a?.ts')
    expect(re.test('ab.ts')).toBe(true)
    expect(re.test('a/.ts')).toBe(false)
  })

  it('anchored slash pattern matches path prefix', () => {
    const re = globToRegExp('src/legacy')
    expect(re.test('src/legacy/old.ts')).toBe(true)
    expect(re.test('src/legacy')).toBe(true)
    expect(re.test('x/src/legacy/old.ts')).toBe(false)
  })

  it('is case-sensitive', () => {
    const re = globToRegExp('*.TS')
    expect(re.test('a.TS')).toBe(true)
    expect(re.test('a.ts')).toBe(false)
  })

  it('signals invalid on unbalanced {', () => {
    expect(() => globToRegExp('{foo')).toThrow()
    expect(() => globToRegExp('foo}')).toThrow()
    expect(() => globToRegExp('{foo,bar}')).toThrow()
  })
})

describe('matchAny', () => {
  it('ORs patterns', () => {
    expect(matchAny(['*.ts', '*.md'], 'a.ts')).toBe(true)
    expect(matchAny(['*.ts', '*.md'], 'a.md')).toBe(true)
    expect(matchAny(['*.ts', '*.md'], 'a.js')).toBe(false)
  })

  it('slash-free matches basename at any depth', () => {
    expect(matchAny(['*.test.ts'], 'src/a.test.ts')).toBe(true)
    expect(matchAny(['*.test.ts'], 'a.test.ts')).toBe(true)
    expect(matchAny(['*.test.ts'], 'src/a.ts')).toBe(false)
  })

  it('slash-free matches any folder segment at any depth', () => {
    expect(matchAny(['fixtures'], 'test/fixtures/a.ts')).toBe(true)
    expect(matchAny(['fixtures'], 'fixtures/a.ts')).toBe(true)
    expect(matchAny(['fixtures'], 'test/other/a.ts')).toBe(false)
  })

  it('slash pattern anchored at root', () => {
    expect(matchAny(['src/legacy'], 'src/legacy/old.ts')).toBe(true)
    expect(matchAny(['src/legacy'], 'x/src/legacy/old.ts')).toBe(false)
  })

  it('empty patterns always returns false', () => {
    expect(matchAny([], 'a.ts')).toBe(false)
  })
})
