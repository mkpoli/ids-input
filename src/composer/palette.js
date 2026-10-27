// Outlines for palette parts absent from the pinned default composer export.
import characters from '../../data/palette-fallback-characters.json' with { type: 'json' }
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'
const supported = new Set(characters)
/** @param {string} text */
export const hasPaletteGlyph = text => supported.has(text)
const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/palette-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Palette outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const paletteSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasPaletteGlyph, fallback })
