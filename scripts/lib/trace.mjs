// A bitmap drawing as an outline of straight lines: the ink of a PNG image, and the polygons that
// run along the edge of that ink.
import { inflateSync } from 'node:zlib'

const SIGNATURE = '89504e470d0a1a0a'
/** The samples a pixel has, by PNG colour type. */
const SAMPLES = /** @type {Record<number, number>} */ ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })

/**
 * The ink of a PNG image, a row after another: a cell is 1 where its pixel is dark and opaque.
 * Reads images that are not interlaced, of 8 bits a sample or of fewer in grey or a palette.
 * @param {Uint8Array} bytes @returns {{ width: number, height: number, ink: Uint8Array }}
 */
export function inkOf(bytes) {
  const file = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (file.subarray(0, 8).toString('hex') !== SIGNATURE) throw new Error('not a PNG image')
  let header = null, palette = null, clear = null
  const packed = []
  for (let at = 8; at + 12 <= file.length;) {
    const length = file.readUInt32BE(at), type = file.toString('latin1', at + 4, at + 8), body = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') header = body
    else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') clear = body
    else if (type === 'IDAT') packed.push(body)
    at += 12 + length
  }
  if (!header) throw new Error('a PNG image without a header')
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4), depth = header[8], kind = header[9]
  const samples = SAMPLES[kind]
  if (!samples || header[12] || depth > 8 || (samples > 1 && depth !== 8)) throw new Error(`a PNG image this does not read: colour type ${kind}, ${depth} bits${header[12] ? ', interlaced' : ''}`)
  const step = Math.max(1, samples * depth / 8), line = Math.ceil(width * samples * depth / 8)
  const data = inflateSync(Buffer.concat(packed))
  const rows = Buffer.alloc(height * line)
  for (let row = 0; row < height; row++) {
    const filter = data[row * (line + 1)], from = row * (line + 1) + 1, to = row * line
    for (let i = 0; i < line; i++) {
      const left = i >= step ? rows[to + i - step] : 0, up = row ? rows[to + i - line] : 0, corner = row && i >= step ? rows[to + i - line - step] : 0
      const nearest = () => {
        const guess = left + up - corner, a = Math.abs(guess - left), b = Math.abs(guess - up), c = Math.abs(guess - corner)
        return a <= b && a <= c ? left : b <= c ? up : corner
      }
      const predicted = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? nearest() : NaN
      if (Number.isNaN(predicted)) throw new Error(`a PNG row filter this does not read: ${filter}`)
      rows[to + i] = (data[from + i] + predicted) & 255
    }
  }
  const most = (1 << depth) - 1
  const ink = new Uint8Array(width * height)
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    let light = 255, opaque = 255
    if (samples === 1) {
      const bit = col * depth, value = (rows[row * line + (bit >> 3)] >> (8 - depth - (bit & 7))) & most
      if (kind === 3) {
        if (!palette || value * 3 + 2 >= palette.length) throw new Error('a PNG pixel outside its palette')
        light = (palette[value * 3] * 299 + palette[value * 3 + 1] * 587 + palette[value * 3 + 2] * 114) / 1000
        opaque = clear && value < clear.length ? clear[value] : 255
      } else light = value * 255 / most
    } else {
      const at = row * line + col * samples
      light = samples >= 3 ? (rows[at] * 299 + rows[at + 1] * 587 + rows[at + 2] * 114) / 1000 : rows[at]
      if (samples === 2 || samples === 4) opaque = rows[at + samples - 1]
    }
    ink[row * width + col] = light < 128 && opaque >= 128 ? 1 : 0
  }
  return { width, height, ink }
}

/** How far a point is from the segment between two others. @param {[number, number]} p @param {[number, number]} a @param {[number, number]} b */
function away(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], span = dx * dx + dy * dy
  const along = span ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span)) : 0
  return Math.hypot(p[0] - a[0] - along * dx, p[1] - a[1] - along * dy)
}

/** The points of a chain that keep every point left out within `tolerance` of it. @param {[number, number][]} chain @param {number} tolerance */
function thinned(chain, tolerance) {
  const keep = new Uint8Array(chain.length)
  keep[0] = keep[chain.length - 1] = 1
  const spans = [[0, chain.length - 1]]
  while (spans.length) {
    const [from, to] = /** @type {[number, number]} */ (spans.pop())
    let far = 0, at = -1
    for (let i = from + 1; i < to; i++) {
      const distance = away(chain[i], chain[from], chain[to])
      if (distance > far) { far = distance; at = i }
    }
    if (far > tolerance) { keep[at] = 1; spans.push([from, at], [at, to]) }
  }
  return chain.filter((_, i) => keep[i])
}

/** The least length of both sides of a corner of the ink for it to be a corner of the drawing. */
const SIDE = 3
/** The least length of a side that can be an edge of the drawing along the grid. */
const FLAT = 8

/**
 * The polygons along the edge of a bitmap's ink, in pixels: a shape is wound one way and a hole in
 * it the other. Ink that meets only at a corner is two shapes. A slanted edge is steps on a grid,
 * and the line it stands for runs through the middle of each step. A side of `FLAT` pixels or more
 * is an edge along the grid and keeps its direction, unless it is a tread between two short risers
 * that turn opposite ways; a corner is kept where both its sides are `SIDE` pixels or longer, and
 * no point left out is farther than `tolerance` from the line.
 * @param {{ width: number, height: number, ink: Uint8Array }} bitmap @param {number} [tolerance]
 * @returns {[number, number][][]}
 */
export function trace({ width, height, ink }, tolerance = 0.6) {
  const at = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < width && y < height && ink[y * width + x] === 1
  const span = width + 1
  // Each side of an ink cell that faces a blank one, walked with the ink on the right: right,
  // down, left and up are directions 0 to 3, and an edge is kept under its start and direction.
  const STEP = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  const edges = new Set()
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!at(x, y)) continue
    if (!at(x, y - 1)) edges.add((y * span + x) * 4)
    if (!at(x + 1, y)) edges.add((y * span + x + 1) * 4 + 1)
    if (!at(x, y + 1)) edges.add(((y + 1) * span + x + 1) * 4 + 2)
    if (!at(x - 1, y)) edges.add(((y + 1) * span + x) * 4 + 3)
  }
  /** @type {[number, number][][]} */
  const polygons = []
  for (const first of edges) {
    if (!edges.has(first)) continue
    /** @type {[number, number][]} */
    const corners = []
    let edge = first
    do {
      edges.delete(edge)
      const direction = edge & 3, start = edge >> 2, x = start % span + STEP[direction][0], y = Math.floor(start / span) + STEP[direction][1]
      // Around the cell first, so cells that meet at a corner stay apart; then on, then the other way.
      const next = [1, 0, 3].map(turn => (y * span + x) * 4 + ((direction + turn) & 3)).find(candidate => edges.has(candidate) || candidate === first)
      if (next === undefined) throw new Error('an edge of the ink that does not close')
      if ((next & 3) !== direction) corners.push([x, y])
      edge = next
    } while (edge !== first)
    // Each side between two corners gives its middle, or a point a pixel from each end where it
    // is an edge along the grid, and a corner between two long sides itself.
    const side = (/** @type {number} */ i) => Math.hypot(corners[(i + 1) % corners.length][0] - corners[i][0], corners[(i + 1) % corners.length][1] - corners[i][1])
    /** @type {[number, number][]} */
    const points = []
    corners.forEach((corner, i) => {
      const before = (i + corners.length - 1) % corners.length, next = (i + 1) % corners.length, after = corners[next], length = side(i)
      const along = (/** @type {number} */ share) => /** @type {[number, number]} */ ([corner[0] + (after[0] - corner[0]) * share, corner[1] + (after[1] - corner[1]) * share])
      // Which way the edge turns at a corner: 1 or -1.
      const turn = (/** @type {number} */ at) => {
        const from = corners[(at + corners.length - 1) % corners.length], here = corners[at], to = corners[(at + 1) % corners.length]
        return Math.sign((here[0] - from[0]) * (to[1] - here[1]) - (here[1] - from[1]) * (to[0] - here[0]))
      }
      const tread = side(before) < SIDE && side(next) < SIDE && turn(i) !== turn(next)
      if (side(before) >= SIDE && length >= SIDE) points.push(corner)
      if (length >= FLAT && !tread) points.push(along(1 / length), along(1 - 1 / length))
      else points.push(along(0.5))
    })
    // The chain starts and turns at the two points farthest apart, which every drawing of it keeps.
    let far = 0
    points.forEach((point, i) => { if (Math.hypot(point[0] - points[0][0], point[1] - points[0][1]) > Math.hypot(points[far][0] - points[0][0], points[far][1] - points[0][1])) far = i })
    const polygon = [...thinned(points.slice(0, far + 1), tolerance), ...thinned([...points.slice(far), points[0]], tolerance).slice(1, -1)]
    if (polygon.length > 2) polygons.push(polygon)
  }
  return polygons
}
