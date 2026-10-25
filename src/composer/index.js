// @ts-check
// han-compose's composer in the browser, as a `preview` for an IDS adapter: a sequence, empty slots
// (＋) and all, drawn in a Web Worker from han-compose's `export-web` output (format 3) at `base`.
// han-compose: https://github.com/mkpoli/han-compose (MIT). The export's outlines come from Noto
// Sans CJK JP and Plangothic (SIL OFL 1.1); a part cut along KanjiVG's groups (`drawn.kanjivg`) is
// shared alike under CC BY-SA 3.0.
import { createDrawer } from './client.js'
import { LIMITS, tooLarge } from './loader.js'
import { parse } from '../core/ids.js'

export { createDrawer } from './client.js'
export { LIMITS, LookupError, compose, createSource, fromUrl, size, sketch, svgBox, tooLarge } from './loader.js'

/**
 * @typedef {import('../adapter/types.js').Drawing} Drawing
 * @typedef {import('../adapter/types.js').PreviewOptions} PreviewOptions
 * @typedef {import('./client.js').WorkerLike} WorkerLike
 */

/** A sequence larger than the composer draws (`LIMITS`). */
export class TooLargeError extends Error { name = 'TooLargeError' }
/** The export could not be read at all (unreachable, refused by CORS, not there, or `base` is no URL): nothing was tried. */
export class UnavailableError extends Error { name = 'UnavailableError' }

/**
 * A `preview` for an IDS adapter, drawing with han-compose from the export at `base` (a folder URL
 * holding `manifest.json`). It answers the drawing, or rejects: with a `TooLargeError` for a
 * sequence larger than `LIMITS`, an `UnavailableError` when the export cannot be read at all, an
 * `AbortError` once its signal aborts, or an Error saying why the composer could not draw it (a part
 * it has no drawing for). `worker` makes the
 * Web Worker; the default is the module worker beside this file.
 * @param {{ base: string, worker?: () => WorkerLike }} options
 * @returns {(sequence: string, options?: PreviewOptions) => Promise<Drawing>}
 */
export function composerPreview({ base, worker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) }) {
  /** @type {ReturnType<typeof createDrawer> | null} */
  let drawer = null
  let asking = 0
  return async (sequence, { signal, onSketch } = {}) => {
    if (tooLarge(parse(sequence, { open: true }).tree ?? null)) throw new TooLargeError(`${sequence} is larger than ${LIMITS.nodes} operators or ${LIMITS.depth} levels.`)
    signal?.throwIfAborted()
    // A base that is no URL rejects here, as an export that cannot be read, and the page goes on.
    if (!drawer) {
      let root
      try { root = new URL(base.endsWith('/') ? base : `${base}/`, globalThis.location?.href).href } catch { throw new UnavailableError(`${base} is not a URL.`) }
      drawer = createDrawer(worker, root)
    }
    // An abort ends this drawing only while it is still the one being drawn; a newer one replaces it anyway.
    const asked = drawer, mine = ++asking
    const stop = () => { if (asking === mine) asked.cancel() }
    signal?.addEventListener('abort', stop, { once: true })
    try {
      const answer = await asked.draw(sequence, leaves => { if (!signal?.aborted) onSketch?.(leaves) })
      if (answer.status === 'composed') return answer.drawn
      if (answer.status === 'cancelled') throw new DOMException('The drawing was replaced.', 'AbortError')
      throw answer.unavailable ? new UnavailableError(answer.error) : new Error(answer.error)
    } finally { signal?.removeEventListener('abort', stop) }
  }
}
