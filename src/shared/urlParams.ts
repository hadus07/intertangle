export interface UrlParams {
  seeds: Set<string>
  scope: string[]
}

export function parseUrlParams(search: string): UrlParams {
  const p = new URLSearchParams(search)
  const rawSeeds = p.get('seeds')
  const rawScope = p.get('scope')
  return {
    seeds: rawSeeds ? new Set(rawSeeds.split(',')) : new Set<string>(),
    scope: rawScope ? rawScope.split(',').filter(Boolean) : [],
  }
}

export function encodeUrlParams(seeds: Set<string>, scope: string[]): URLSearchParams {
  const p = new URLSearchParams()
  if (seeds.size > 0) p.set('seeds', [...seeds].join(','))
  if (scope.length > 0) p.set('scope', scope.join(','))
  return p
}
