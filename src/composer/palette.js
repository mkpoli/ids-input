// Noto outlines for palette parts the Sans export lacks. With `under`, another face's export answers
// first, so that face keeps its own glyphs.
import characters from '../../data/palette-fallback-characters.json' with { type: 'json' }
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'
import { download } from '../core/retry.js'
const supported = new Set(characters)
/** @param {string} text */
export const hasPaletteGlyph = text => supported.has(text)
const loadOutlines = async () => {
  const response = await download(new URL('../../data/palette-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Palette outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** @param {{ load?: () => Promise<any>, fallback?: any, under?: boolean }} options */
export const paletteSource = ({ load = loadOutlines, fallback = null, under = false } = {}) =>
  bundledSource({ load, matches: hasPaletteGlyph, fallback, under })
