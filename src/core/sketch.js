// @ts-check
// A hand-drawn shape matched against glyph shapes. Strokes are fitted into a square and drawn as
// ink; each shape's ink is compared with the other's by how far it lies from it, and a coarse
// histogram of stroke directions keeps parts of a shape in their places. Both measures are turned
// into orders — how much closer one shape is than another — so they can be added without a scale.
//
// A drawing is compared at a little larger and smaller than its bounding box, since a hand rarely
// fills the square the way a glyph does.

/** The side of the square a shape is fitted to. */
export const SIZE = 40
/** The space left around a shape in the square. */
export const MARGIN = 2
/** How much larger or smaller a drawing is tried against a template. */
export const SCALES = [0.85, 1, 1.15]
const CELLS = 5
const BINS = 8

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {Point[]} Stroke */
/** @typedef {{ mask: Uint8Array, distance: Uint8Array, gradient: Float32Array, ink: number, points: Uint16Array }} Shape */

/** A shape with one side much shorter than the other has no useful proportions to stretch. */
const lopsided = (/** @type {number} */ w, /** @type {number} */ h) => Math.min(w, h) < 3 || Math.min(w, h) < Math.max(w, h) * 0.2

/**
 * The strokes fitted into a `size` square, then a `factor` larger or smaller about the centre. A
 * drawing is stretched to fill the square unless `stretch` is false, so that a part drawn narrow
 * still meets the wider glyph a font draws; with `stretch` false its own proportions are kept.
 * @param {Stroke[]} strokes
 * @param {{ size?: number, margin?: number, factor?: number, stretch?: boolean }} [options]
 * @returns {Stroke[]}
 */
export function fitStrokes(strokes, { size = SIZE, margin = MARGIN, factor = 1, stretch = true } = {}) {
  const points = strokes.flat()
  if (!points.length) return []
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const { x, y } of points) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const room = (size - 2 * margin) * factor
  const across = room / Math.max(x1 - x0, 1), down = room / Math.max(y1 - y0, 1)
  const uniform = Math.min(across, down)
  const flat = lopsided(x1 - x0, y1 - y0)
  const sx = stretch && !flat ? across : uniform, sy = stretch && !flat ? down : uniform
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  return strokes.map(stroke => stroke.map(({ x, y }) => ({ x: size / 2 + (x - cx) * sx, y: size / 2 + (y - cy) * sy })))
}

/**
 * A dilation by `radius` pixels, so that a small difference in where a stroke starts does not count
 * as a hole.
 * @param {Uint8Array} mask @param {number} size @param {number} [radius]
 * @returns {Uint8Array}
 */
function dilate(mask, size, radius = 1) {
  const out = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!mask[y * size + x]) continue
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) out[ny * size + nx] = 1
    }
  }
  return out
}

/**
 * The strokes drawn as ink on a `size` square. A stroke of one point is a dot.
 * @param {Stroke[]} strokes
 * @param {{ size?: number, margin?: number, factor?: number, stretch?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function rasterize(strokes, options = {}) {
  const { size = SIZE } = options
  const mask = new Uint8Array(size * size)
  /** @param {number} x @param {number} y */
  const stamp = (x, y) => {
    const px = Math.round(x), py = Math.round(y)
    if (px >= 0 && px < size && py >= 0 && py < size) mask[py * size + px] = 1
  }
  for (const stroke of fitStrokes(strokes, options)) {
    if (!stroke.length) continue
    if (stroke.length === 1) { stamp(stroke[0].x, stroke[0].y); continue }
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1], b = stroke[i]
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2))
      for (let step = 0; step <= steps; step++) stamp(a.x + (b.x - a.x) * step / steps, a.y + (b.y - a.y) * step / steps)
    }
  }
  return dilate(mask, size, 2)
}

/**
 * A glyph's alpha channel fitted into a `size` square the way a drawing is: its ink's bounding box
 * fills the square, stretched unless `stretch` is false.
 * @param {ArrayLike<number>} alpha One alpha per pixel.
 * @param {number} width @param {number} height
 * @param {{ size?: number, margin?: number, threshold?: number, stretch?: boolean }} [options]
 * @returns {Uint8Array | null} null when there is no ink.
 */
export function fitMask(alpha, width, height, { size = SIZE, margin = MARGIN, threshold = 24, stretch = true } = {}) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (alpha[y * width + x] <= threshold) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < x0 || y1 < y0) return null
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1
  const room = size - 2 * margin
  const uniform = room / Math.max(bw, bh)
  // A dot or a hairline has no useful proportions to stretch.
  const flat = lopsided(bw, bh)
  const sx = stretch && !flat ? room / bw : uniform, sy = stretch && !flat ? room / bh : uniform
  const left = (size - bw * sx) / 2, top = (size - bh * sy) / 2
  const mask = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px0 = x0 + (x - left) / sx, py0 = y0 + (y - top) / sy
    if (px0 < x0 - 1 || px0 > x1 + 1 || py0 < y0 - 1 || py0 > y1 + 1) continue
    // The largest alpha under the cell, so a thin stem is not lost when a glyph is made smaller.
    let most = 0
    for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
      const px = Math.floor(px0) + ox, py = Math.floor(py0) + oy
      if (px >= 0 && px < width && py >= 0 && py < height) most = Math.max(most, alpha[py * width + px])
    }
    if (most > threshold) mask[y * size + x] = 1
  }
  return mask
}

/**
 * How far every cell is from the nearest ink, by the 3-4 chamfer: 1 across, about 1.4 diagonally.
 * @param {Uint8Array} mask @param {number} [size]
 * @returns {Uint8Array}
 */
export function distanceTransform(mask, size = SIZE) {
  const far = 1e9
  const distance = new Float32Array(size * size)
  for (let i = 0; i < distance.length; i++) distance[i] = mask[i] ? 0 : far
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x
    if (distance[i] === 0) continue
    let d = distance[i]
    if (x > 0) d = Math.min(d, distance[i - 1] + 1)
    if (y > 0) d = Math.min(d, distance[i - size] + 1)
    if (x > 0 && y > 0) d = Math.min(d, distance[i - size - 1] + 1.414)
    if (x < size - 1 && y > 0) d = Math.min(d, distance[i - size + 1] + 1.414)
    distance[i] = d
  }
  for (let y = size - 1; y >= 0; y--) for (let x = size - 1; x >= 0; x--) {
    const i = y * size + x
    let d = distance[i]
    if (x < size - 1) d = Math.min(d, distance[i + 1] + 1)
    if (y < size - 1) d = Math.min(d, distance[i + size] + 1)
    if (x < size - 1 && y < size - 1) d = Math.min(d, distance[i + size + 1] + 1.414)
    if (x > 0 && y < size - 1) d = Math.min(d, distance[i + size - 1] + 1.414)
    distance[i] = d
  }
  const out = new Uint8Array(size * size)
  for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.round(distance[i]))
  return out
}

/**
 * A coarse histogram of stroke direction over a 5×5 grid, each cell's eight directions counted and
 * normalized, so a shape is compared by where its strokes run rather than only where its ink is.
 * @param {Uint8Array} mask @param {number} [size]
 * @returns {Float32Array}
 */
export function gradientHistogram(mask, size = SIZE) {
  const blurred = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let sum = 0, n = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) { sum += mask[ny * size + nx]; n++ }
    }
    blurred[y * size + x] = sum / n
  }
  const out = new Float32Array(CELLS * CELLS * BINS)
  const cell = size / CELLS
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const dx = blurred[y * size + x + 1] - blurred[y * size + x - 1]
    const dy = blurred[(y + 1) * size + x] - blurred[(y - 1) * size + x]
    const weight = Math.hypot(dx, dy)
    if (weight < 0.02) continue
    let angle = Math.atan2(dy, dx)
    if (angle < 0) angle += Math.PI * 2
    const bin = Math.min(BINS - 1, Math.floor(angle / (Math.PI * 2) * BINS))
    const at = (Math.min(CELLS - 1, Math.floor(y / cell)) * CELLS + Math.min(CELLS - 1, Math.floor(x / cell))) * BINS + bin
    out[at] += weight
  }
  for (let c = 0; c < CELLS * CELLS; c++) {
    let norm = 0
    for (let b = 0; b < BINS; b++) norm += out[c * BINS + b] ** 2
    norm = Math.sqrt(norm) || 1
    for (let b = 0; b < BINS; b++) out[c * BINS + b] /= norm
  }
  return out
}

/**
 * Everything kept of a shape for matching: its ink, the distance from every cell to that ink, and
 * the direction histogram.
 * @param {Uint8Array} mask
 * @param {number} [size]
 * @returns {Shape}
 */
export function describe(mask, size = SIZE) {
  /** @type {number[]} */
  const points = []
  for (let i = 0; i < mask.length; i++) if (mask[i]) points.push(i)
  return { mask, distance: distanceTransform(mask, size), gradient: gradientHistogram(mask, size), ink: points.length, points: Uint16Array.from(points) }
}

/**
 * The shapes a drawing is tried as: stretched to the square and with its own proportions, at `SCALES`.
 * @param {Stroke[]} strokes
 * @param {{ size?: number, margin?: number }} [options]
 * @returns {Shape[]}
 */
export function shapesOf(strokes, options = {}) {
  /** @type {Shape[]} */
  const shapes = []
  for (const stretch of [false, true]) for (const factor of SCALES) {
    const shape = describe(rasterize(strokes, { ...options, factor, stretch }), options.size ?? SIZE)
    if (shape.ink > 0) shapes.push(shape)
  }
  return shapes
}

/**
 * How far the ink of one shape lies from the ink of the other, and back, on average. Small is close.
 * @param {Shape} a @param {Shape} b
 */
export function chamfer(a, b) {
  let out = 0, back = 0
  for (const i of a.points) out += b.distance[i]
  for (const i of b.points) back += a.distance[i]
  return (a.points.length ? out / a.points.length : 99) + (b.points.length ? back / b.points.length : 99)
}

/**
 * The distance between two direction histograms.
 * @param {Float32Array} a @param {Float32Array} b
 */
export function gradientDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

/**
 * `templates` ordered by how closely they look like any of `shapes`: the orders of every template
 * under the two measures are added, so neither measure's unit matters.
 * A drawn part usually has as many strokes as the part it is: candidates within one stroke of the
 * drawing come before the rest.
 * @template {{ shapes: Shape[], strokes?: number | null, uses?: number }} T
 * @param {Shape[]} shapes
 * @param {T[]} templates
 * @param {{ limit?: number, strokes?: number }} [options]
 * @returns {T[]}
 */
export function rank(shapes, templates, { limit = 24, strokes } = {}) {
  if (!shapes.length || !templates.length) return []
  const chamferScores = new Float64Array(templates.length).fill(Infinity)
  const gradientScores = new Float64Array(templates.length).fill(Infinity)
  templates.forEach((template, i) => {
    for (const shape of shapes) for (const other of template.shapes) {
      chamferScores[i] = Math.min(chamferScores[i], chamfer(shape, other))
      gradientScores[i] = Math.min(gradientScores[i], gradientDistance(shape.gradient, other.gradient))
    }
  })
  const chamferOrder = Array.from(chamferScores.keys()).sort((a, b) => chamferScores[a] - chamferScores[b])
  const gradientOrder = Array.from(gradientScores.keys()).sort((a, b) => gradientScores[a] - gradientScores[b])
  const score = new Float64Array(templates.length)
  chamferOrder.forEach((at, order) => { score[at] += order })
  gradientOrder.forEach((at, order) => { score[at] += order * 0.6 })
  // A part drawn with a stroke or two joined is still that part; a part of four or more strokes is
  // less likely to be drawn with two fewer.
  const span = strokes !== undefined && strokes <= 2 ? 2 : 1
  const close = templates.map(template => strokes === undefined || template.strokes === null || template.strokes === undefined
    || Math.abs(strokes - template.strokes) <= span)
  if (strokes !== undefined) templates.forEach((template, at) => {
    if (template.strokes !== null && template.strokes !== undefined) score[at] += Math.min(Math.abs(strokes - template.strokes), 6) * 12
  })
  // Among equally close shapes, the part more often used as a component is the likelier one.
  templates.forEach((template, at) => { score[at] -= Math.log10((template.uses ?? 0) + 1) * 6 })
  return Array.from(score.keys()).sort((a, b) => Number(!close[a]) - Number(!close[b]) || score[a] - score[b] || chamferScores[a] - chamferScores[b])
    .slice(0, limit).map(at => templates[at])
}
