// @ts-nocheck: geometry over plain arrays, as in the composer's own drawing.
import { isDescription as isWhole } from './ids.js'

// What the editor's preview shows: the badge on its frame, and the placeholder an empty slot (or a
// part not drawn yet) becomes, in the drawing's 1000-unit box.

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
  return { label: 'draft', params: {} }
}

/** The face a whole character fills in the drawing's box ([x, y, width, height], y down): the median
 *  box of full ideographs (han-compose's `Composer.face`), where placeholders stand before the layout
 *  has loaded. */
export const FACE = [38.42, 39.94, 928.36, 921.56]

/** The stroke width a placeholder is drawn with where no drawing gives one: the font's at weight 400. */
export const STROKE = 80

/**
 * A placeholder in `box` ([x, y, width, height], y down): a rounded rectangle inset by half a stroke,
 * outlined in dots a stroke wide, with nothing at its centre that could read as a stroke. `stroke` is
 * the stroke width of the drawing beside it. Answers `{ x, y, width, height, rx, dot, gap, dots }`:
 * the rectangle, the dots' width, their spacing and how many go round.
 */
export function placeholder(box, stroke = STROKE) {
  const [bx, by, bw, bh] = box
  const s = Math.max(24, Math.min(stroke, Math.min(bw, bh) / 5))
  const inset = Math.min(s / 2, bw / 4, bh / 4)
  const width = Math.max(bw - 2 * inset, 1), height = Math.max(bh - 2 * inset, 1)
  const rx = Math.min(Math.min(width, height) * 0.18, 3 * s)
  // As many dots as fit the outline at about a stroke and a bit apart, so they close evenly round it.
  const perimeter = 2 * (width + height) - 8 * rx + 2 * Math.PI * rx
  return { x: bx + inset, y: by + inset, width, height, rx, dot: s * 0.42, gap: s * 1.15, dots: Math.max(4, Math.round(perimeter / (s * 1.15))) }
}

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
 * @param {{ preview?: Function, drawing?: Function, signal: AbortSignal }} asking
 * @param {(patch: { step?: string, url?: string, drawn?: object, sketch?: object[] }) => void} update
 */
export function runPreview(text, { preview, drawing, signal }, update) {
  const whole = isWhole(text)
  let final = false
  const none = () => { if (!signal.aborted && !preview && !final) update({ step: 'idle' }) }
  if (drawing && whole) drawing(text, { signal }).then(url => {
    if (signal.aborted) return
    if (!url) { none(); return }
    final = true
    update({ step: 'final', url })
  }, none)
  if (!preview) { if (!drawing || !whole) none(); return }
  preview(text, { signal, onSketch: sketch => { if (!signal.aborted) update({ sketch }) } }).then(drawn => {
    if (!signal.aborted && !final) update({ step: 'composed', drawn })
  }, error => {
    if (!signal.aborted && !final) update({ step: error?.name === 'TooLargeError' ? 'capped' : error?.name === 'UnavailableError' ? 'unavailable' : 'failed' })
  })
}

/** Path data with nothing but its commands and numbers, its line breaks and tabs kept as separators. */
const pathData = d => String(d ?? '').replace(/[\t\n\r]/g, ' ').replace(/[^MLHVCSQTAZmlhvcsqtaz0-9.,eE+\- ]/g, '')
/** A colour as an SVG attribute takes it: `#rgb`, `#rrggbb` or `#rrggbbaa`; anything else is refused. */
const colour = (value, fallback) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value ?? '') ? value : fallback

/**
 * A drawing (`Drawing` in the adapter types) as a file of its own: an SVG of its ink in `ink` on
 * `background` (none for a transparent one), `padding` the share of the 1000-unit box added on each
 * side, `size` its width and height in pixels. Empty slots are left out unless `placeholders`, which
 * draws each as the editor does, in the ink at half strength.
 * @param {{ d: string, cut?: string, slots?: { index: number, box: number[] }[], stroke?: number[] | null }} drawing
 * @param {{ background?: string | null, ink?: string, padding?: number, size?: number, placeholders?: boolean }} [options]
 * @returns {string}
 */
export function drawingSvg(drawing, { background = null, ink = '#000000', padding = 0, size = 1000, placeholders = false } = {}) {
  // Every number written is a finite number, whatever it was handed.
  const num = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
  const pad = Math.round(Math.max(0, Math.min(num(padding, 0), 0.5)) * 1000 * 100) / 100
  size = Math.max(1, Math.round(num(size, 1000)))
  const span = 1000 + 2 * pad, fill = colour(ink, '#000000')
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${span} ${span}" width="${size}" height="${size}">`]
  const back = background === null ? null : colour(background, null)
  if (back) out.push(`<rect x="${-pad}" y="${-pad}" width="${span}" height="${span}" fill="${back}"/>`)
  const d = pathData(drawing.d), cut = pathData(drawing.cut)
  if (cut) out.push(`<mask id="cut"><rect x="${-pad}" y="${-pad}" width="${span}" height="${span}" fill="#fff"/><path d="${cut}" fill="#000"/></mask>`)
  if (d) out.push(`<path d="${d}" fill="${fill}"${cut ? ' mask="url(#cut)"' : ''}/>`)
  if (placeholders) for (const slot of drawing.slots ?? []) {
    const box = (slot.box ?? []).slice(0, 4).map(v => num(v, 0))
    if (box.length < 4) continue
    const p = placeholder(box, num(drawing.stroke?.[0], STROKE))
    const r = v => Math.round(v * 100) / 100
    out.push(`<rect x="${r(p.x)}" y="${r(p.y)}" width="${r(p.width)}" height="${r(p.height)}" rx="${r(p.rx)}" fill="none" stroke="${fill}" stroke-opacity="0.5" stroke-width="${r(p.dot)}" stroke-linecap="round" pathLength="${p.dots}" stroke-dasharray="0 1"/>`)
  }
  out.push('</svg>')
  return out.join('')
}
