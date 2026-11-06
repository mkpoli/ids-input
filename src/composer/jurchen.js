// @ts-check
// Outlines for Unicode's Jurchen characters and radicals.
import { isJurchen, JURCHEN_VARIANT } from '../core/ids.js'
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'
import { download } from '../core/retry.js'

export const hasJurchen = isJurchen
const loadOutlines = async () => {
  const response = await download(new URL('../../data/jurchen-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Jurchen outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** A Jurchen character with a variation selector that has no record of its own is drawn as the character. @param {string} key */
const baseOf = key => JURCHEN_VARIANT.test(key) ? [...key][0] : key
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const jurchenSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasJurchen, fallback, alias: baseOf })
