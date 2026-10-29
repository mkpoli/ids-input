// @ts-check
// Palette parts drawn into small glyph masks for the sketch search, when the adapter has no prepared
// `sketches` file. The glyphs come from the page's own font stack, so a host that shows the parts
// already has what the search needs; the templates are built when the Find tab opens and kept for
// the page.
import { describe, fitMask, SIZE } from '../core/sketch.js'

/** The glyph is drawn at this size, then fitted down to `SIZE`. */
const RENDER = 64
/** Glyphs drawn and read back at once. */
const CHUNK = 64
const FONT_SIZE = Math.round(RENDER * 0.86)

/**
 * @typedef {import('../adapter/types.js').PalettePart} PalettePart
 * @typedef {import('../core/sketch-data.js').SketchTemplate} SketchTemplate
 */

/** @type {Map<string, SketchTemplate[]>} */
const cache = new Map()
/** Builds still running, so a reopened pad joins one rather than starting over. @type {Map<string, Promise<SketchTemplate[]>>} */
const pending = new Map()

/** Parts that are one character and used as a part often enough to look for by shape. */
const WANTED = new Set(['c', 'd', 's'])
/** A part below this many uses is too rare to be drawn by hand in a search. */
export const MIN_USES = 50

/** @param {number} ms */
const wait = ms => new Promise(done => setTimeout(done, ms))

/**
 * How much of two masks is the same. A part no font draws comes out as the notdef box, the same
 * shape for every such part.
 * @param {Uint8Array} a @param {Uint8Array} b
 */
const alike = (a, b) => {
  let same = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++
  return same / a.length
}

/**
 * @param {PalettePart[]} parts
 * @returns {PalettePart[]}
 */
export function sketchParts(parts) {
  return parts.filter(part => [...part.part].length === 1 && WANTED.has(part.kind ?? '')
    && (part.kind === 's' || part.uses === undefined || part.uses >= MIN_USES))
}

/** @param {PalettePart[]} parts */
const signature = parts => parts.map(part => `${part.part}:${part.uses ?? 0}:${part.kind ?? ''}`).join('|')

/**
 * The templates for `parts`, from the cache when this set was built before. `onProgress` hears how
 * many are done, and `signal` stops the work.
 * @param {PalettePart[]} parts
 * @param {{ font?: string, onProgress?: (done: number, total: number) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<SketchTemplate[]>}
 */
export function sketchTemplates(parts, { font = 'sans-serif', onProgress, signal } = {}) {
  const wanted = sketchParts(parts)
  const key = `${font}|${signature(wanted)}`
  const kept = cache.get(key)
  if (kept) { onProgress?.(kept.length, kept.length); return Promise.resolve(kept) }
  if (typeof document === 'undefined') return Promise.resolve([])
  const started = pending.get(key)
  if (started) return started
  const task = buildTemplates(wanted, key, font, onProgress, signal).finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}

/**
 * @param {PalettePart[]} wanted @param {string} key @param {string} font
 * @param {((done: number, total: number) => void) | undefined} onProgress
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<SketchTemplate[]>}
 */
async function buildTemplates(wanted, key, font, onProgress, signal) {
  // A face that never settles must not hold the pad shut.
  await Promise.race([document.fonts.ready, wait(1500)])
  const canvas = document.createElement('canvas')
  canvas.width = RENDER
  canvas.height = RENDER * CHUNK
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#000'
  context.font = `${FONT_SIZE}px ${font}`
  // What a missing glyph looks like in this face, to leave such parts out of the comparison.
  context.clearRect(0, 0, RENDER, RENDER)
  context.fillText('\u{10FFFF}', RENDER / 2, RENDER / 2)
  const missing = context.getImageData(0, 0, RENDER, RENDER).data
  const missingAlpha = new Uint8Array(RENDER * RENDER)
  for (let i = 0; i < missingAlpha.length; i++) missingAlpha[i] = missing[i * 4 + 3]
  const notdef = [fitMask(missingAlpha, RENDER, RENDER, { size: SIZE, stretch: false }), fitMask(missingAlpha, RENDER, RENDER, { size: SIZE })]
  const templates = []
  // Glyphs are drawn in a column and read back a chunk at a time: one readback for many glyphs
  // costs far less than one each.
  for (let start = 0; start < wanted.length; start += CHUNK) {
    if (signal?.aborted) return []
    const chunk = wanted.slice(start, start + CHUNK)
    context.clearRect(0, 0, RENDER, RENDER * chunk.length)
    chunk.forEach((part, i) => context.fillText(part.part, RENDER / 2, RENDER / 2 + i * RENDER))
    const data = context.getImageData(0, 0, RENDER, RENDER * chunk.length).data
    for (let i = 0; i < chunk.length; i++) {
      const part = chunk[i]
      const alpha = new Uint8Array(RENDER * RENDER)
      for (let y = 0; y < RENDER; y++) for (let x = 0; x < RENDER; x++) alpha[y * RENDER + x] = data[((i * RENDER + y) * RENDER + x) * 4 + 3]
      const masks = [fitMask(alpha, RENDER, RENDER, { size: SIZE, stretch: false }), fitMask(alpha, RENDER, RENDER, { size: SIZE })]
      /** @type {import('../core/sketch.js').Shape[]} */
      const shapes = []
      masks.forEach((mask, i) => {
        if (!mask || (notdef[i] && alike(mask, notdef[i]) >= 0.98)) return
        const shape = describe(mask, SIZE)
        if (shape.ink >= 8) shapes.push(shape)
      })
      if (!shapes.length) continue
      templates.push({ part: part.part, strokes: part.strokes ?? null, uses: part.uses ?? 0, shapes })
    }
    onProgress?.(Math.min(wanted.length, start + chunk.length), wanted.length)
    await wait(0)
    if (signal?.aborted) return []
  }
  onProgress?.(wanted.length, wanted.length)
  cache.set(key, templates)
  return templates
}
