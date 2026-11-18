// @ts-check
// A resize moves both edges of a stem. Measure across the original ink and move the
// resized edges back towards (or away from) their shared centre by half the width change.
import { ASCENT, pathRings } from '@han-compose/composer/geometry'
import { applyAffine, transformPath } from './transform.js'

/** @typedef {[number, number]} Point */
/** @typedef {import('./transform.js').Piece} Piece */
/** @typedef {{ start: Point, end: Point, tangent: Point, winding: number }} Edge */
/** @typedef {{ points: Point[], edges: Edge[] }} Ring */

const EDGE_LIMIT = 1200
const EPS = 1e-5
/** @param {Point} a @param {Point} b */
const minus = (a, b) => /** @type {Point} */ ([a[0] - b[0], a[1] - b[1]])
/** @param {Point} a @param {Point} b */
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
/** @param {Point} a @param {Point} b */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
/** @param {Point} a */
const normal = a => /** @type {Point} */ ([-a[1], a[0]])
/** @param {Point} a @param {number} scale */
const times = (a, scale) => /** @type {Point} */ ([a[0] * scale, a[1] * scale])

/** @param {number[][]} paths @param {boolean} cut @returns {Ring[]} */
function rings(paths, cut) {
  const contours = paths.map(path => {
    /** @type {Point[]} */
    const points = []
    for (let i = 0; i < path.length; i += 2) {
      const next = /** @type {Point} */ ([path[i], ASCENT - path[i + 1]])
      const last = points.at(-1)
      if (!last || Math.hypot(...minus(next, last)) > EPS) points.push(next)
    }
    if (points.length > 1 && Math.hypot(...minus(points[0], points[points.length - 1])) <= EPS) points.pop()
    const signed = points.reduce((sum, point, i) => sum + cross(point, points[(i + 1) % points.length]), 0)
    return { points, signed }
  }).filter(({ points }) => points.length >= 3)
  // Keep the winding of counters relative to their outer contour, including a cut
  // that the document source has split into a piece of its own.
  const outer = contours.reduce((max, { signed }) => Math.abs(signed) > Math.abs(max) ? signed : max, 0)
  const winding = (Math.sign(outer) || 1) * (cut ? -1 : 1)
  return contours.map(({ points }) => ({
    points,
    edges: points.map((start, i) => {
      const end = points[(i + 1) % points.length], run = minus(end, start)
      return { start, end, tangent: times(run, 1 / Math.hypot(...run)), winding }
    }),
  }))
}

/** @param {Edge} side @param {Edge[]} edges @param {Point} ray @param {number} limit @param {number} along */
function acrossInk(side, edges, ray, limit, along) {
  const origin = /** @type {Point} */ ([
    side.start[0] * (1 - along) + side.end[0] * along,
    side.start[1] * (1 - along) + side.end[1] * along,
  ])
  let winding = 0, forward = Infinity, back = -Infinity
  /** @type {Edge | undefined} */
  let ahead, behind
  for (const edge of edges) {
    if (edge === side) continue
    const other = minus(edge.end, edge.start)
    const denom = cross(ray, other)
    if (Math.abs(denom) < EPS) continue
    const from = minus(edge.start, origin)
    const position = cross(from, ray) / denom
    if (position < 0 || position >= 1) continue
    const distance = cross(from, other) / denom
    if (distance > EPS) {
      winding += Math.sign(denom) * edge.winding
      if (distance < forward) { forward = distance; ahead = edge }
    } else if (distance < -EPS && distance > back) { back = distance; behind = edge }
  }
  const otherSide = winding - side.winding
  // Both sides can be filled where two strokes overlap. Only compensate a boundary of ink.
  if (Boolean(winding) === Boolean(otherSide)) return 0
  const match = winding ? ahead : behind
  const width = winding ? forward : back
  if (!match || Math.abs(width) > limit || dot(match.tangent, side.tangent) * match.winding * side.winding > -0.7) return 0
  return width
}

/** @param {Point} before @param {Point} after @param {number} a @param {number} b */
function join(before, after, a, b) {
  const det = cross(before, after)
  const max = 2 * Math.max(Math.abs(a), Math.abs(b))
  if (dot(before, after) < 0.92 && Math.abs(det) > EPS) {
    const shift = /** @type {Point} */ ([(a * after[1] - b * before[1]) / det, (b * before[0] - a * after[0]) / det])
    if (Math.hypot(...shift) <= max) return shift
  }
  return /** @type {Point} */ ([(a * before[0] + b * after[0]) / 2, (a * before[1] + b * after[1]) / 2])
}

/**
 * Spread abrupt changes in displacement along short contour edges. Keeping each
 * change shorter than the edge prevents small segments at curved caps folding back.
 * @param {Point[]} points @param {Point[]} shifts @param {Point[]} normals
 */
function smoothShifts(points, shifts, normals) {
  const runs = points.map((point, i) => minus(points[(i + 1) % points.length], point))
  const limits = runs.map((run, i) => {
    const previous = (i + normals.length - 1) % normals.length, next = (i + 1) % normals.length
    const smooth = dot(normals[i], normals[previous]) > 0.8 || dot(normals[i], normals[next]) > 0.8
    return smooth ? Math.hypot(...run) * 0.65 : Infinity
  })
  for (let pass = 0; pass < 16; pass++) {
    let stable = true
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      const delta = minus(shifts[j], shifts[i]), length = Math.hypot(...delta)
      if (length <= limits[i] + EPS) continue
      const change = times(delta, (1 - limits[i] / length) / 2)
      shifts[i] = [shifts[i][0] + change[0], shifts[i][1] + change[1]]
      shifts[j] = minus(shifts[j], change)
      stable = false
    }
    if (stable) return true
  }
  return runs.every((run, i) => dot(run, minus(shifts[(i + 1) % points.length], shifts[i])) > -dot(run, run))
}

/**
 * Preserve the widths of opposing outline edges that form a measurable stem. End caps and
 * joins without a matching edge travel with the resize. Rigid motions keep the original curves.
 * @param {Piece[]} pieces @param {number[]} base The composer's placement into canvas units.
 * @param {number[]} edit The authored affine map in canvas units.
 * @param {number[]} stroke The composer's horizontal and vertical stem measurements.
 * @returns {Piece[] | null}
 */
export function keepStrokeWidth(pieces, base, edit, stroke) {
  const [a, b, c, d] = edit
  const det = a * d - b * c
  if (Math.abs(Math.hypot(a, b) - 1) < EPS && Math.abs(Math.hypot(c, d) - 1) < EPS && Math.abs(a * c + b * d) < EPS) return null
  const shapes = pieces.map(piece => {
    const placed = transformPath(piece.d, [{ type: 'affine', matrix: base }]).d
    return rings(pathRings(placed), Boolean(piece.cut))
  })
  const edges = shapes.flatMap(shape => shape.flatMap(ring => ring.edges))
  if (edges.length > EDGE_LIMIT || !edges.length) return null
  return shapes.map((shape, i) => {
    const original = pieces[i]
    if (!shape.length) return { ...original, ...transformPath(original.d, [{ type: 'affine', matrix: base }, { type: 'affine', matrix: edit }]) }
    let changed = false, stable = true
    const paths = shape.map(({ points, edges: sides }) => {
      const offsets = sides.map(side => {
        const [x, y] = side.tangent, tangent = /** @type {Point} */ ([a * x + c * y, b * x + d * y])
        const run = Math.hypot(...tangent), ratio = Math.abs(det) / run
        const outward = normal(side.tangent)
        const limit = 2.2 * Math.hypot(outward[0] * stroke[0], outward[1] * stroke[1])
        // A crossing through the centre can obscure a long stem. Check its exposed ends too.
        const worthMeasuring = Math.abs(ratio - 1) >= EPS
        let width = worthMeasuring ? acrossInk(side, edges, outward, limit, 0.5) : 0
        if (!width && worthMeasuring && Math.hypot(...minus(side.end, side.start)) >= limit) {
          width = acrossInk(side, edges, outward, limit, 0.25) || acrossInk(side, edges, outward, limit, 0.75)
        }
        const offset = width * (ratio - 1) / 2
        if (Math.abs(offset) > EPS) changed = true
        return { normal: times(normal(tangent), Math.sign(det) / run), offset }
      })
      const scaled = points.map(point => applyAffine(edit, point))
      const shifts = offsets.map((after, k) => {
        const before = offsets[(k + offsets.length - 1) % offsets.length]
        return join(before.normal, after.normal, before.offset, after.offset)
      })
      if (!smoothShifts(scaled, shifts, offsets.map(offset => offset.normal))) stable = false
      return scaled.map(([x, y], k) => {
        const [dx, dy] = shifts[k]
        return `${k ? 'L' : 'M'}${(x + dx).toFixed(3)} ${(y + dy).toFixed(3)}`
      }).join('') + 'Z'
    })
    if (!changed || !stable) return { ...original, ...transformPath(original.d, [{ type: 'affine', matrix: base }, { type: 'affine', matrix: edit }]) }
    return { ...original, d: paths.join(''), approximate: true }
  })
}
