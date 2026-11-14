// @ts-nocheck: geometry over plain arrays, as in a drawing.
import { entryDescription, isDescription as isWhole, parse, withoutVariants, write } from './ids.js'

// What the editor's preview shows around a drawing: its badge, and the boxes where nothing is drawn
// yet (a fast layout before the engine's has loaded). The drawing itself — its file, its parts by
// leaf, the placeholder of a slot, where an emoji stands — is the engine's (han-compose's package).
export { drawingSvg, EMOJI_CUT_MATRIX, emojiPlace, EMOJI_SCALE, emojiTransform } from '@han-compose/composer/drawing-svg'
export { groupParts, placeholder, STROKE } from '@han-compose/composer'

/**
 * The badge of a preview: `{ label, params }`, `label` a key under `ids.preview.`. `step` is
 * `loading`, `composed`, `final`, `failed` or `capped` (too large to draw); `drawn` is the composer's
 * answer (`Drawing` in the adapter types). A drawing using an operator the composer does not draw is
 * approximate, with the operators in `params.ops`.
 * @param {string} step
 * @param {{ approximate?: string[] } | null} [drawn]
 * @returns {{ label: string, params: Record<string, string> }}
 */
export function badge(step, drawn = null) {
  if (step === 'loading') return { label: 'loading', params: {} }
  if (step === 'final') return { label: 'final', params: {} }
  if (step === 'failed') return { label: 'failed', params: {} }
  if (step === 'capped') return { label: 'tooLarge', params: {} }
  if (step === 'composed' && drawn?.approximate?.length) return { label: 'approximate', params: { ops: drawn.approximate.join(' ') } }
  if (step === 'composed' && drawn?.cells) return { label: 'cells', params: {} }
  return { label: 'draft', params: {} }
}

/** The face a whole character fills in the drawing's box ([x, y, width, height], y down): the median
 *  box of full ideographs (han-compose's `Composer.face`), where placeholders stand before the layout
 *  has loaded. */
export const FACE = [38.42, 39.94, 928.36, 921.56]

// A description laid out roughly, before even the composer's layout has loaded: each part in a box its
// operators give it, in a unit square with y down, where the preview's placeholders stand. ⿰ ⿲ split it into columns,
// ⿱ ⿳ into rows, an enclosure puts its first part in the whole box and its second where the
// composer's `INSIDE` puts a part no host shows, ⿻ and ㇯ lay both parts over the whole box (㇯'s
// second as a cut), ⿾ mirrors and ⿿ turns what it holds. A tree is the core's: a component is its
// text, a node `{ op, parts }`, an empty slot null.

// Where an enclosed part sits, as shares of the box (x0, y0, x1, y1), y down: han-compose's INSIDE
// turned over, with ⿼ and ⿽ added as mirrors of ⿷ and ⿸.
const INSIDE = {
  '⿴': [0.2, 0.2, 0.8, 0.85], '⿵': [0.2, 0.2, 0.8, 1], '⿶': [0.2, 0, 0.8, 0.8], '⿷': [0.2, 0.15, 1, 0.85],
  '⿸': [0.3, 0.22, 1, 1], '⿹': [0, 0.22, 0.75, 1], '⿺': [0.3, 0, 1, 0.75], '⿼': [0, 0.15, 0.8, 0.85], '⿽': [0, 0, 0.7, 0.75],
}
const ROWS = { '⿰': [0, 2], '⿲': [0, 3], '⿱': [1, 2], '⿳': [1, 3] }

/**
 * The leaves of `tree` with their boxes: `{ char, box, flip, cut }`, `char` null for an empty slot,
 * `box` [x0, y0, x1, y1] in the unit square, `flip` [x, y] whether its glyph is mirrored in its box.
 */
export function roughLayout(tree, box = [0, 0, 1, 1], flip = [false, false], cut = false, out = []) {
  if (tree === null || typeof tree === 'string') { out.push({ char: tree, box, flip, cut }); return out }
  const { op, parts } = tree
  if (ROWS[op]) {
    const [axis, n] = ROWS[op], span = (box[axis + 2] - box[axis]) / n
    parts.forEach((part, i) => {
      const b = box.slice()
      b[axis] = box[axis] + i * span
      b[axis + 2] = box[axis] + (i + 1) * span
      roughLayout(part, b, flip, cut, out)
    })
  } else if (INSIDE[op]) {
    roughLayout(parts[0], box, flip, cut, out)
    const [a, b, c, d] = INSIDE[op], w = box[2] - box[0], h = box[3] - box[1]
    roughLayout(parts[1], [box[0] + a * w, box[1] + b * h, box[0] + c * w, box[1] + d * h], flip, cut, out)
  } else if (op === '⿾' || op === '⿿') {
    // Mirrored about the box's centre: each leaf's box moves across it and its glyph turns over.
    for (const leaf of roughLayout(parts[0], box, flip, cut)) {
      const [x0, y0, x1, y1] = leaf.box, turned = op === '⿿'
      out.push({ ...leaf, box: [box[0] + box[2] - x1, turned ? box[1] + box[3] - y1 : y0, box[0] + box[2] - x0, turned ? box[1] + box[3] - y0 : y1],
        flip: [!leaf.flip[0], turned ? !leaf.flip[1] : leaf.flip[1]] })
    }
  } else if (op === '㇯') {
    roughLayout(parts[0], box, flip, cut, out)
    roughLayout(parts[1], box, flip, true, out)
  } else parts.forEach(part => roughLayout(part, box, flip, cut, out))
  return out
}

/**
 * One description's turn in a preview: the adapter's `drawing` (a final image of a whole
 * description) and its `preview` (a drawing, empty slots and all) asked for `text`, each answer
 * handed to `update` as `{ step, url }`, `{ step, drawn }`, `{ step }` or `{ sketch }`. A final image
 * wins over a drawing. Where there is nothing to show (no preview, and no final image for this
 * text) the step is `idle` with nothing shown, so no image of an earlier description stays; where the
 * preview's data cannot be read at all, `unavailable`, which shows placeholders with no badge. Nothing
 * is handed over once `signal` aborts.
 * @param {string} text
 * @param {{ preview?: Function, drawing?: Function, formed?: (text: string, options?: { signal?: AbortSignal }) => Promise<string | null>, signal: AbortSignal }} asking
 *   `formed` answers the description with each form a variant identifier names written as what
 *   draws it, or null where it names none; such a description has no final image.
 * @param {(patch: { step?: string, url?: string, drawn?: object, sketch?: object[] }) => void} update
 */
export function runPreview(text, { preview, drawing, formed, signal }, update) {
  // A zi.tools entry draws its description; its notes are not part of the text asked for.
  // A variant identifier says which form of a component is meant; one glyph is drawn for each.
  const read = /[.0-9A-Za-z]/.test(text) ? parse(text, { open: true }) : null
  const plain = read && !read.problem && read.tree !== null ? write(withoutVariants(read.tree)) : entryDescription(text)
  /** @param {string} asked @param {Function | undefined} drawing */
  const run = (asked, drawing) => {
    const whole = isWhole(asked)
    let final = false
    const none = () => { if (!signal.aborted && !preview && !final) update({ step: 'idle' }) }
    if (drawing && whole) drawing(asked, { signal }).then(url => {
      if (signal.aborted) return
      if (!url) { none(); return }
      final = true
      update({ step: 'final', url })
    }, none)
    if (!preview) { if (!drawing || !whole) none(); return }
    preview(asked, { signal, onSketch: sketch => { if (!signal.aborted) update({ sketch }) } }).then(drawn => {
      if (!signal.aborted && !final) update({ step: 'composed', drawn })
    }, error => {
      if (!signal.aborted && !final) update({ step: error?.name === 'TooLargeError' ? 'capped' : error?.name === 'UnavailableError' ? 'unavailable' : 'failed' })
    })
  }
  // Only a text that may carry an identifier is asked about; the rest draw as they always did. One
  // component with its identifier is no description, and is asked about all the same.
  if (!formed || !preview || !read || (!read.problem && plain === entryDescription(text))) { run(plain, drawing); return }
  formed(text, { signal }).then(shaped => shaped, () => null).then(shaped => {
    if (signal.aborted) return
    if (shaped) run(shaped, undefined)
    else run(plain, drawing)
  })
}

/**
 * `ask` asked for what draws a description: `drawable` writes each component no code point names as
 * a character or a description first, and the answer's parts and sketch are numbered by the
 * components of the description asked for, so a part chosen in the tree is the part drawn. Without
 * either, `ask` as it is.
 * @template {((text: string, options?: any) => Promise<any>) | undefined} T
 * @param {T} ask @param {((text: string, options?: any) => Promise<{ text: string, leaves: number[] }>) | undefined} drawable @returns {T}
 */
export function askDrawable(ask, drawable) {
  if (!ask || !drawable) return ask
  const wrapped = async (text, options) => {
    const swap = /[{&#]/.test(text) ? await drawable(text, { signal: options?.signal }).catch(() => null) : null
    if (!swap || swap.text === text) return ask(text, options)
    const place = index => swap.leaves[index] ?? index
    const onSketch = options?.onSketch && (sketch => options.onSketch(ownSketch(sketch, place)))
    const drawn = await ask(swap.text, { ...options, onSketch })
    if (!drawn) return drawn
    /** @param {{ leaf?: number }} item */
    const own = item => item.leaf === undefined ? item : { ...item, leaf: place(item.leaf) }
    return { ...drawn, ...(drawn.parts ? { parts: drawn.parts.map(own) } : {}), ...(drawn.emoji ? { emoji: drawn.emoji.map(own) } : {}) }
  }
  if (ask.warm) wrapped.warm = ask.warm
  return wrapped
}

/** A sketch's leaves gathered by the component each draws: one leaf per place, its box around all
 * of them. @param {{ index: number, box: number[], empty: boolean }[]} sketch @param {(index: number) => number} place */
function ownSketch(sketch, place) {
  const out = new Map()
  for (const leaf of sketch) {
    const index = place(leaf.index), [x, y, w, h] = leaf.box, seen = out.get(index)
    if (!seen) { out.set(index, { ...leaf, index, box: [x, y, w, h] }); continue }
    const x0 = Math.min(seen.box[0], x), y0 = Math.min(seen.box[1], y)
    seen.box = [x0, y0, Math.max(seen.box[0] + seen.box[2], x + w) - x0, Math.max(seen.box[1] + seen.box[3], y + h) - y0]
  }
  return [...out.values()].sort((a, b) => a.index - b.index)
}

/** Path data with nothing but its commands and numbers, its line breaks and tabs kept as separators. */
const pathData = d => String(d ?? '').replace(/[\t\n\r]/g, ' ').replace(/[^MLHVCSQTAZmlhvcsqtaz0-9.,eE+\- ]/g, '')
/** A transform list with nothing but SVG transform functions: its letters, numbers, spaces, commas and brackets. */
const transformData = t => String(t ?? '').slice(0, 500).replace(/[^a-zA-Z0-9()., -]/g, '')
/** A colour as an SVG attribute takes it: `#rgb`, `#rrggbb`, `#rrggbbaa` or `currentColor`; anything else is refused. */
const colour = (value, fallback) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value ?? '') ? value : /^currentcolor$/i.test(value ?? '') ? 'currentColor' : fallback

/**
 * A drawing (`Drawing` in the adapter types) as a file of its own: an SVG of its ink in `ink` on
 * `background` (none for a transparent one), `padding` the share of the 1000-unit box added on each
 * side, `size` its width and height in pixels, `idPrefix` the start of the ids of its mask and filter, for a page that holds several. Empty slots are left out unless `placeholders`, which
 * draws each as the editor does, in the ink at half strength.
 * @param {{ d: string, cut?: string, slots?: { index: number, box: number[] }[], stroke?: number[] | null,
 *   parts?: { d: string, cut?: boolean, leaf?: number }[], transforms?: (string | null)[], emoji?: { text: string, box: number[], part?: number, flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[] }} drawing
 * @param {{ background?: string | null, ink?: string, padding?: number, size?: number, placeholders?: boolean, idPrefix?: string }} [options]
 * @returns {string}
 */

/** The area two [x, y, width, height] boxes share. */
const shared = (a, b) => {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])
  return w > 0 && h > 0 ? w * h : 0
}

