// Each entry names contours in the Serif export, including its own cut boxes
// and chain joins. The guide's special 父 (qq222) has one published drawing.
import data from './baishi-serif-outlines.json' with { type: 'json' }
import layers from './baishi-serif-layers.json' with { type: 'json' }
import witnesses from './baishi-serif-witnesses.json' with { type: 'json' }
import kage from './baishi-serif-kage.json' with { type: 'json' }

/** @typedef {import('./baishi-cheatsheet.js').Glyph} Glyph */
/** @typedef {Pick<Glyph, 'parts' | 'rest' | 'joins' | 'cross'> & { source?: string }} LayerMap */
const entries = /** @type {Record<string, LayerMap>} */ (layers)
/** @type {Record<string, string[]>} */
const special = { ...witnesses.glyphs, ...kage }
/** @type {Record<string, string[]>} */
export const glyphs = data.glyphs
export const composed = data.composed
export const base = data.base
/** @type {Record<string, string>} */
export const forms = { ...witnesses.variants, '𠃊t': witnesses.variants.乚t,
  '𤽄.': glyphs['𤽄'].join(''), '十.t': special['十.t'].join(''), '午t': kage.risingNoon.join(''), '午.': special.午.join('') }

/** @param {Glyph} glyph @param {string} entry @returns {Glyph} */
export function glyphFor(glyph, entry) {
  if (glyph.char === '父' && entry === '⿱儿.乂.(qq222)') return glyph
  const shape = entries[glyph.char + ' ' + entry]
  if (!shape) throw new Error('Missing Serif illustration for ' + entry)
  return { char: glyph.char, composed: glyph.composed, ...shape,
    contours: shape.source ? special[shape.source] : glyphs[glyph.char] }
}
