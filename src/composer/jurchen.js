// @ts-check
// Outlines for Unicode's Jurchen characters and radicals.
import { isJurchen } from '../core/ids.js'
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'
import { download } from '../core/retry.js'

export const hasJurchen = isJurchen
const loadOutlines = async () => {
  const response = await download(new URL('../../data/jurchen-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Jurchen outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const jurchenSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasJurchen, fallback })
