// @ts-check
// han-compose's composer in the browser, as a `preview` for an IDS adapter: a sequence, empty slots
// (⬚) and all, drawn in a Web Worker from han-compose's `export-web` output (format 5) at `base`.
// han-compose: https://github.com/mkpoli/han-compose (MIT). The export's outlines come from Noto
// Sans CJK JP and Plangothic (SIL OFL 1.1); a part cut along KanjiVG's groups (`drawn.kanjivg`) is
// shared alike under CC BY-SA 3.0.
import { createDrawer } from './client.js'
import { LIMITS, tooLarge } from './loader.js'
import { isNode, parse, write } from '../core/ids.js'
import { emojiPrefix } from '../core/emoji.js'
import { groupParts } from '../core/preview.js'
import { onlyBundled } from './local.js'

export { unicodeSource, hasUnicodeGlyph } from './unicode.js'
export { createDrawer } from './client.js'
export { LIMITS, LookupError, compose, createSource, fromUrl, size, sketch, svgBox, tooLarge } from './loader.js'

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

/** Replace emoji sequences with empty slots while the composer calculates their positions. @param {string} sequence */
function emojiSlots(sequence) {
  const parsed = parse(sequence, { open: true })
  if (parsed.problem || !parsed.tree) return { sequence, slots: [], slotLeaves: [], unsupported: false }
  /** @type {(string | null)[]} */
  const slots = []
  /** @type {number[]} */
  const slotLeaves = []
  let leaf = 0, unsupported = false
  /** @param {import('../core/ids.js').Part} part @returns {import('../core/ids.js').Part} */
  function convert(part) {
    if (isNode(part)) {
      const start = slots.length
      const parts = part.parts.map(convert)
      if (['⿾', '⿿', '㇯'].includes(part.op) && slots.slice(start).some(Boolean)) unsupported = true
      return { ...part, parts }
    }
    const index = leaf++
    if (part === null) { slots.push(null); slotLeaves.push(index); return null }
    if (emojiPrefix(part) === part && ([...part].length > 1 || /\p{Emoji_Presentation}/u.test(part))) { slots.push(part); slotLeaves.push(index); return null }
    return part
  }
  const result = convert(parsed.tree)
  return { sequence: write(result), slots, slotLeaves, unsupported }
}

/** How many drawings a preview keeps for a repeated sequence. */
const CACHE = 32

/**
 * A `preview` for an IDS adapter, drawing with han-compose from the export at `base` (a folder URL
 * holding `manifest.json`). Tangut and Bopomofo outlines are bundled; descriptions using only these need no Han
 * export, and mixed descriptions combine both sources. It answers the drawing, or rejects: with a `TooLargeError` for a
 * sequence larger than `LIMITS`, an `UnavailableError` when the export cannot be read at all, an
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
    if (tooLarge(parse(sequence, { open: true }).tree ?? null)) throw new TooLargeError(`${sequence} is larger than ${LIMITS.nodes} operators or ${LIMITS.depth} levels.`)
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
    const prepared = emojiSlots(sequence)
    if (prepared.unsupported) throw new Error('Emoji cannot yet be mirrored, rotated or subtracted in the preview.')
    const asked = open(prepared.sequence), mine = ++asking
    const stop = () => { if (asking === mine) asked.cancel() }
    signal?.addEventListener('abort', stop, { once: true })
    try {
      let sketch = null
      const answer = await asked.draw(prepared.sequence, leaves => {
        sketch = leaves.map(leaf => ({ ...leaf, empty: prepared.slotLeaves.some((index, slot) => index === leaf.index && prepared.slots[slot]) ? false : leaf.empty }))
        if (!signal?.aborted) onSketch?.(sketch)
      }, { separate, fontStyle })
      if (answer.status === 'composed') {
        const drawn = answer.drawn
        const emoji = (drawn.slots ?? []).flatMap(slot => {
          const text = prepared.slots[slot.index]
          return text ? [{ text, box: slot.box, leaf: prepared.slotLeaves[slot.index], part: -1 }] : []
        })
        if (emoji.length) {
          const existing = drawn.parts ?? []
          const originalSketch = /** @type {import('../adapter/types.js').SketchLeaf[] | null} */ (sketch)
          const oldSketch = originalSketch?.map(leaf => ({ ...leaf, empty: emoji.some(item => item.leaf === leaf.index) || leaf.empty })) ?? []
          const groups = existing.length ? groupParts(existing, oldSketch) : []
          if (groups) {
            const pieces = existing.map(part => ({ ...part }))
            for (const group of groups) for (const index of group.parts) pieces[index].leaf = group.index
            for (const item of emoji) {
              item.part = pieces.length
              pieces.push({ leaf: item.leaf, origin: 'emoji', box: item.box, d: '' })
            }
            drawn.parts = pieces
          }
          drawn.emoji = emoji
          drawn.slots = (drawn.slots ?? []).filter(slot => !prepared.slots[slot.index]).map((slot, index) => ({ ...slot, index }))
        }
        remember(sequence, drawn, sketch); return drawn
      }
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
