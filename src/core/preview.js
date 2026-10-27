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
/** A transform list with nothing but the functions `partTransform` writes: its letters, numbers, spaces, commas and brackets. */
const transformData = t => String(t ?? '').slice(0, 500).replace(/[^a-zA-Z0-9()., \-]/g, '')
/** A colour as an SVG attribute takes it: `#rgb`, `#rrggbb` or `#rrggbbaa`; anything else is refused. */
const colour = (value, fallback) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value ?? '') ? value : fallback

/**
 * A drawing (`Drawing` in the adapter types) as a file of its own: an SVG of its ink in `ink` on
 * `background` (none for a transparent one), `padding` the share of the 1000-unit box added on each
 * side, `size` its width and height in pixels. Empty slots are left out unless `placeholders`, which
 * draws each as the editor does, in the ink at half strength.
 * @param {{ d: string, cut?: string, slots?: { index: number, box: number[] }[], stroke?: number[] | null,
 *   parts?: { d: string, cut?: boolean }[], transforms?: (string | null)[], emoji?: { text: string, box: number[] }[] }} drawing
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
  // A view may hand over one transform per drawn part, to move, scale or turn a component. A cut
  // drawing stays merged: its mask is taken across parts.
  const transforms = Array.isArray(drawing.transforms) ? drawing.transforms : null
  const pieces = Array.isArray(drawing.parts) ? drawing.parts : null
  const split = !cut && transforms?.some(transform => typeof transform === 'string' && transform)
    && pieces?.every(piece => typeof piece.d === 'string')
  if (split) {
    for (let i = 0; i < pieces.length; i++) {
      const piece = pathData(pieces[i].d)
      if (!piece) continue
      const transform = transformData(transforms[i])
      out.push(transform ? `<g transform="${transform}"><path d="${piece}" fill="${fill}"/></g>` : `<path d="${piece}" fill="${fill}"/>`)
    }
  } else if (d) out.push(`<path d="${d}" fill="${fill}"${cut ? ' mask="url(#cut)"' : ''}/>`)
  for (const emoji of drawing.emoji ?? []) {
    const box = (emoji.box ?? []).slice(0, 4).map(v => num(v, 0))
    if (box.length < 4 || typeof emoji.text !== 'string') continue
    const [x, y, width, height] = box
    const text = emoji.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out.push(`<text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.max(0, Math.min(width, height) * 0.85)}" font-family="system-ui, sans-serif">${text}</text>`)
  }
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

// ---------------------------------------------------------------- adjusting a drawing's parts
// A view that lets a host move, scale or turn one component of a drawing needs each drawn part
// grouped by the leaf it belongs to: the composer draws a part as one or more pieces, and the
// sketch says where each leaf was laid out.

/** The area two [x, y, width, height] boxes share. */
const shared = (a, b) => {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])
  return w > 0 && h > 0 ? w * h : 0
}
/** The box around [x, y, width, height] boxes. */
const around = boxes => {
  const x = Math.min(...boxes.map(b => b[0])), y = Math.min(...boxes.map(b => b[1]))
  return [x, y, Math.max(...boxes.map(b => b[0] + b[2])) - x, Math.max(...boxes.map(b => b[1] + b[3])) - y]
}

/**
 * The drawn parts grouped by the leaf of `leaves` each belongs to: `{ index, parts, box }[]`, `index`
 * the leaf's place in reading order, `parts` the indices into `pieces`, and `box` the box around
 * them. Null when the pieces cannot be told apart by leaf: one piece spans two leaves (the composer
 * drew the whole description as one glyph), or a filled leaf has no piece. A leaf drawn in several
 * pieces groups them together.
 * @param {{ box: number[], leaf?: number }[]} pieces
 * @param {{ index: number, box: number[], empty?: boolean }[]} leaves
 * @returns {{ index: number, parts: number[], box: number[] }[] | null}
 */
export function groupParts(pieces, leaves) {
  if (!Array.isArray(pieces) || !Array.isArray(leaves)) return null
  const filled = leaves.filter(leaf => leaf && !leaf.empty && Array.isArray(leaf.box) && leaf.box.length >= 4
    && leaf.box.slice(0, 4).every(Number.isFinite))
  if (!filled.length || pieces.length < filled.length) return null
  if (!pieces.every(piece => Array.isArray(piece?.box) && piece.box.length >= 4 && piece.box.slice(0, 4).every(Number.isFinite))) return null
  if (pieces.every(piece => Number.isInteger(piece.leaf))) {
    const groups = filled.map(leaf => {
      const parts = pieces.flatMap((piece, i) => piece.leaf === leaf.index ? [i] : [])
      return { index: leaf.index, parts, box: parts.length ? around(parts.map(i => pieces[i].box)) : [] }
    })
    return groups.every(group => group.parts.length) && groups.reduce((sum, group) => sum + group.parts.length, 0) === pieces.length ? groups : null
  }
  // A separated drawing gives each leaf one piece, in reading order. That is the only reliable map
  // when leaves share a box (⿻, an enclosure's outer part): the boxes cannot tell them apart.
  if (pieces.length === filled.length) {
    return filled.map((leaf, i) => ({ index: leaf.index, parts: [i], box: pieces[i].box.slice(0, 4) }))
  }
  /** @type {Map<number, number[]>} */
  const grouped = new Map(filled.map(leaf => [leaf.index, []]))
  for (let i = 0; i < pieces.length; i++) {
    const box = pieces[i]?.box
    if (!Array.isArray(box) || box.length < 4 || !box.slice(0, 4).every(Number.isFinite)) return null
    const shares = filled.map(leaf => ({ index: leaf.index, area: shared(box, leaf.box), leafArea: leaf.box[2] * leaf.box[3] }))
      .sort((a, b) => b.area - a.area)
    const best = shares[0]
    if (!(best.area > 0)) return null
    // A piece lying equally in two leaves belongs to the smaller, inner one when one leaf encloses the
    // other (the part inside an enclosure), and to neither when the leaves are neighbours of a similar
    // size: that is a whole glyph, not a part.
    const near = shares.filter(share => share.area >= best.area * 0.99)
    if (near.length > 1) {
      const smallest = Math.min(...near.map(share => share.leafArea)), largest = Math.max(...near.map(share => share.leafArea))
      if (smallest > largest * 0.75) return null
      const inner = near.reduce((a, b) => a.leafArea <= b.leafArea ? a : b)
      grouped.get(inner.index)?.push(i)
    } else {
      grouped.get(best.index)?.push(i)
    }
  }
  const out = []
  for (const leaf of filled) {
    const parts = grouped.get(leaf.index)
    if (!parts?.length) return null
    out.push({ index: leaf.index, parts, box: around(parts.map(i => pieces[i].box)) })
  }
  return out
}

/**
 * The SVG transform that moves, scales and turns a part about the centre of `box`: `translate(dx dy)`
 * first, then scale and rotation about the centre. Empty when the adjustment changes nothing.
 * @param {{ dx?: number, dy?: number, scale?: number, rotate?: number } | null | undefined} adjustment
 * @param {number[]} box [x, y, width, height]
 */
export function partTransform(adjustment, box) {
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : fallback
  const dx = num(adjustment?.dx), dy = num(adjustment?.dy), scale = num(adjustment?.scale, 1), rotate = num(adjustment?.rotate)
  if (!dx && !dy && scale === 1 && !rotate) return ''
  const [x, y, width, height] = (Array.isArray(box) ? box : []).slice(0, 4).map(value => num(value))
  const cx = num(x + width / 2), cy = num(y + height / 2)
  const out = []
  if (dx || dy) out.push(`translate(${dx} ${dy})`)
  out.push(`translate(${cx} ${cy})`)
  if (rotate) out.push(`rotate(${rotate})`)
  if (scale !== 1) out.push(`scale(${scale})`)
  out.push(`translate(${-cx} ${-cy})`)
  return out.join(' ')
}
