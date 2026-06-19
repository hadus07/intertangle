function convertToken(pattern: string, i: number): [string, number] {
  if (pattern[i] === '*' && pattern[i + 1] === '*') {
    const skip = pattern[i + 2] === '/' ? 3 : 2
    return ['.*', i + skip]
  }
  if (pattern[i] === '*') return ['[^/]*', i + 1]
  if (pattern[i] === '?') return ['[^/]', i + 1]
  return [(pattern[i] as string).replace(/[.+^$()|[\]\\]/g, '\\$&'), i + 1]
}

export function globToRegExp(pattern: string): RegExp {
  if (pattern.includes('{') || pattern.includes('}')) throw new Error('invalid glob')
  let src = ''
  let i = 0
  while (i < pattern.length) {
    const [token, next] = convertToken(pattern, i)
    src += token
    i = next
  }
  return new RegExp(pattern.includes('/') ? `^${src}(/.*)?$` : `^${src}$`)
}

export function matchAny(patterns: string[], path: string): boolean {
  return patterns.some(p => {
    const re = globToRegExp(p)
    if (p.includes('/')) return re.test(path)
    return path.split('/').some(seg => re.test(seg))
  })
}
