// @ts-check
// han-compose's composer in the browser, as a `preview` for an IDS adapter: a sequence, empty slots
// (⬚) and all, drawn in a Web Worker from han-compose's `export-web` output (format 5) at `base`.
// han-compose: https://github.com/mkpoli/han-compose (MIT). The export's outlines come from Noto
// Sans CJK JP and Plangothic (SIL OFL 1.1); a part cut along KanjiVG's groups (`drawn.kanjivg`) is
// shared alike under CC BY-SA 3.0.
import { createDrawer } from './client.js'
import { LIMITS, PYRAMID_LAYERS, tooLarge } from './loader.js'
import { parse } from '../core/ids.js'
import { onlyBundled } from './local.js'

export { unicodeSource, hasUnicodeGlyph } from './unicode.js'
export { createDrawer } from './client.js'
export { LIMITS, PYRAMID_LAYERS, LookupError, compose, createSource, fromUrl, size, sketch, svgBox, tooLarge } from './loader.js'

/**
 * @typedef {import('../adapter/types.js').Drawing} Drawing
 * @typedef {import('../adapter/types.js').PreviewOptions} PreviewOptions
 * @typedef {import('./client.js').WorkerLike} WorkerLike
 * @typedef {((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & { warm: (sequence?: string) => void }} ComposerPreview
 */

/** A sequence larger than the composer draws (`LIMITS`). */
export class TooLargeError extends Error { name = 'TooLargeError' }
/** The export could not be read at all (unreachable, refused by CORS, not there, or `base` is no URL): nothing was tried. */
export class UnavailableError extends Error { name = 'UnavailableError' }

/** How many drawings a preview keeps for a repeated sequence. */
const CACHE = 32

/**
 * A `preview` for an IDS adapter, drawing with han-compose from the export at `base` (a folder URL
 * holding `manifest.json`). Tangut and Bopomofo outlines are bundled; descriptions using only these need no Han
 * export, and mixed descriptions combine both sources. It answers the drawing, or rejects: with a `TooLargeError` for a
 * sequence larger than `LIMITS` (or a pyramid taller than `PYRAMID_LAYERS`), an `UnavailableError` when the export cannot be read at all, an
 * `AbortError` once its signal aborts, or an Error saying why the composer could not draw it (a part
 * it has no drawing for). `separate` draws operands as individual pieces where possible, including
 * cuts from a matching whole glyph. A sequence drawn once is answered from memory
 * next time. `warm()` starts the worker on the manifest and layout before the first drawing.
 * `worker` makes the Web Worker; the default is the module worker beside this file.
 * @param {{ base: string, separate?: boolean, fontStyle?: 'sans' | 'serif' | 'kaisho', worker?: () => WorkerLike }} options
 * @returns {ComposerPreview}
 */
export function composerPreview({ base, separate = false, fontStyle = 'sans', worker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) }) {
  /** @type {ReturnType<typeof createDrawer> | null} */
  let drawer = null
  let asking = 0
  let warmed = false
  /** @type {Map<string, { drawn: Drawing, sketch: import('../adapter/types.js').SketchLeaf[] | null }>} */
  const drawings = new Map()
  /** @param {string} sequence @param {Drawing} drawn @param {import('../adapter/types.js').SketchLeaf[] | null} sketch */
  function remember(sequence, drawn, sketch) {
    drawings.delete(sequence)
    drawings.set(sequence, { drawn, sketch })
    if (drawings.size > CACHE) {
      const oldest = drawings.keys().next().value
      if (oldest !== undefined) drawings.delete(oldest)
    }
  }
  /** The drawer, made once; a base that is no URL is reported as unavailable. */
  function open(sequence = '') {
    let root
    try { root = new URL(base.endsWith('/') ? base : `${base}/`, globalThis.location?.href).href } catch {
      if (!onlyBundled(sequence, false, true, fontStyle)) throw new UnavailableError(`${base} is not a URL.`)
      root = base
    }
    if (!drawer) drawer = createDrawer(worker, root)
    return drawer
  }
  const preview = /** @type {ComposerPreview} */ (async (sequence, { signal, onSketch } = {}) => {
    if (tooLarge(parse(sequence, { open: true }).tree ?? null)) throw new TooLargeError(`${sequence} is larger than ${LIMITS.nodes} operators, ${LIMITS.depth} levels, or ${PYRAMID_LAYERS} pyramid rows.`)
    signal?.throwIfAborted()
    const cached = drawings.get(sequence)
    if (cached) {
      drawings.delete(sequence)
      drawings.set(sequence, cached)
      // The sketch is part of the answer: a view needs it to group the drawing's parts.
      if (cached.sketch) onSketch?.(cached.sketch)
      return cached.drawn
    }
    // An abort ends this drawing only while it is still the one being drawn; a newer one replaces it anyway.
    const asked = open(sequence), mine = ++asking
    const stop = () => { if (asking === mine) asked.cancel() }
    signal?.addEventListener('abort', stop, { once: true })
    try {
      let sketch = null
      const answer = await asked.draw(sequence, leaves => {
        sketch = leaves
        if (!signal?.aborted) onSketch?.(leaves)
      }, { separate, fontStyle })
      if (answer.status === 'composed') { remember(sequence, answer.drawn, sketch); return answer.drawn }
      if (answer.status === 'cancelled') throw new DOMException('The drawing was replaced.', 'AbortError')
      throw answer.unavailable ? new UnavailableError(answer.error) : new Error(answer.error)
    } finally { signal?.removeEventListener('abort', stop) }
  })
  preview.warm = () => {
    if (warmed) return
    warmed = true
    try { open().warm() } catch { /* the first drawing reports the base */ }
  }
  return preview
}

export { composeDocumentSource, documentSource } from './document-source.js'
