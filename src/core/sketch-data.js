// @ts-check
// The prepared glyph masks of the sketch search, as `scripts/build_sketch_parts.py` writes them: a
// compact set of 40×40 bitmaps, one stretched and one with the glyph's own proportions, so the pad
// opens without drawing the palette in the browser.
import { describe, SIZE } from './sketch.js'

/** What `format` says in the file. */
export const SKETCH_FORMAT = 'ids-input/sketch-parts'
/** The file's layout version. */
export const SKETCH_VERSION = 1

/**
 * @typedef {{ part: string, strokes: number | null, uses: number, shapes: import('./sketch.js').Shape[] }} SketchTemplate
 * @typedef {{ format: string, version: number, size: number, font?: string, parts: [string, number | null, number, string | null, string | null][] }} SketchData
 */

/** @param {string} text */
function bytes(text) {
  if (typeof atob === 'function') {
    const binary = atob(text)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(text, 'base64'))
}

/** @param {string} packed @param {number} size */
function unpack(packed, size) {
  const data = bytes(packed)
  if (data.length < Math.ceil(size * size / 8)) throw new Error('sketch data: a mask is too short')
  const mask = new Uint8Array(size * size)
  for (let i = 0; i < mask.length; i++) mask[i] = (data[i >> 3] >> (i & 7)) & 1
  return mask
}

/**
 * The templates in a decoded `sketch-parts.json` document, each shape described for matching.
 * @param {SketchData} document
 * @returns {SketchTemplate[]}
 */
export function readSketchTemplates(document) {
  if (!document || document.format !== SKETCH_FORMAT || document.version !== SKETCH_VERSION) throw new Error('sketch data: unknown format')
  if (document.size !== SIZE) throw new Error(`sketch data: expected ${SIZE}×${SIZE} masks, got ${document.size}`)
  return document.parts.map(([part, strokes, uses, stretched, kept]) => {
    /** @type {import('./sketch.js').Shape[]} */
    const shapes = []
    for (const packed of [stretched, kept]) {
      if (packed === null || packed === undefined) continue
      if (typeof packed !== 'string' || !packed) throw new Error(`sketch data: ${part} has an unreadable mask`)
      const shape = describe(unpack(packed, SIZE), SIZE)
      if (shape.ink >= 8) shapes.push(shape)
    }
    if (!shapes.length) throw new Error(`sketch data: ${part} has no usable mask`)
    return { part, strokes: strokes ?? null, uses: uses ?? 0, shapes }
  }).filter(template => template.shapes.length > 0)
}
