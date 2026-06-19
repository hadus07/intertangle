import { parseUrlParams as sharedParse } from '~shared/urlParams'

export type { UrlParams } from '~shared/urlParams'
export { encodeUrlParams } from '~shared/urlParams'

export function parseUrlParams(search = window.location.search) {
  return sharedParse(search)
}
