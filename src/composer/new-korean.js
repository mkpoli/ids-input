// @ts-check
// Outlines for the unencoded letters of the New Korean Orthography.
import { isNewKorean } from '../core/ids.js'
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'

export const hasNewKorean = isNewKorean
const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/new-korean-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`New Korean outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const newKoreanSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasNewKorean, fallback })
