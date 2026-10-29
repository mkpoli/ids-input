// @ts-check
// Outlines for the Shuishu characters at the proposed block's tentative allocations.
import { isShuishu } from '../core/ids.js'
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'

export const hasShuishu = isShuishu
const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/shuishu-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Shuishu outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const shuishuSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasShuishu, fallback })
