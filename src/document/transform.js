// @ts-check
// Geometry evaluation for document transforms: affine composition, projective and Möbius point
// maps, and SVG path transformation. Affine chains stay exact; a chain with one projective or
// Möbius operation is flattened within a tolerance, after conservatively checking that its pole
// lies outside the path's control hull.

/** @typedef {import('./model.js').Chain} Chain */
/** @typedef {import('./model.js').Operation} Operation */
/** @typedef {import('./model.js').Affine} Affine */
/** @typedef {import('./model.js').Projective} Projective */
/** @typedef {import('./model.js').Mobius} Mobius */
/** @typedef {[number, number]} Point */
/** @typedef {{ d: string, fillRule?: 'nonzero' | 'evenodd', cut?: boolean }} Piece */

/** An operation the transform engine cannot evaluate, or a path that would leave the finite plane. */
export class TransformError extends Error {
  /** @param {'unknown' | 'pole' | 'chain' | 'path' | 'precision'} reason @param {string} message */
  constructor(reason, message) {
    super(message)
    this.name = 'TransformError'
    this.reason = reason
  }
}

/** The identity affine matrix. @type {number[]} */
export const IDENTITY = [1, 0, 0, 1, 0, 0]

/** @param {number[]} matrix @param {Point} point @returns {Point} */
export const applyAffine = (matrix, [x, y]) => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
]

/** The inverse of an affine matrix, or null when it is singular. @param {number[]} matrix @returns {number[] | null} */
export function invertAffine(matrix) {
  const [a, b, c, d, e, f] = matrix
  const determinant = a * d - b * c
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant].map(value => value === 0 ? 0 : value)
}

/** Compose two affine matrices: the result applies `inner` first, then `outer`.
 * @param {number[]} outer @param {number[]} inner @returns {number[]} */
export function multiplyAffine(outer, inner) {
  const [a, b, c, d, e, f] = outer
  const [g, h, i, j, k, l] = inner
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ]
}

/** @param {Operation[]} operations @returns {number[]} */
function affineProduct(operations) {
  let matrix = IDENTITY
  for (const operation of operations) {
    if (operation.type !== 'affine') throw new TransformError('chain', 'expected an affine operation')
    matrix = multiplyAffine(/** @type {number[]} */ (operation.matrix), matrix)
  }
  return matrix
}

/** Whether every operation is affine. @param {Chain} chain */
export const chainIsAffine = chain => chain.every(operation => operation.type === 'affine')

/** The combined affine matrix of an all-affine chain, or null. @param {Chain} chain */
export function affineForChain(chain) {
  return chainIsAffine(chain) ? affineProduct(chain) : null
}

/** Apply one affine, projective or Möbius operation; null at a pole or an unknown operation.
 * @param {Operation} operation @param {Point} point @returns {Point | null} */
export function applyOperation(operation, point) {
  if (operation.type === 'affine') return applyAffine(/** @type {number[]} */ (operation.matrix), point)
  if (operation.type === 'projective') {
    const m = /** @type {number[]} */ (operation.matrix), [x, y] = point
    const X = m[0] * x + m[1] * y + m[2]
    const Y = m[3] * x + m[4] * y + m[5]
    const W = m[6] * x + m[7] * y + m[8]
    if (!Number.isFinite(W) || Math.abs(W) < 1e-12 || !Number.isFinite(X) || !Number.isFinite(Y)) return null
    return [X / W, Y / W]
  }
  if (operation.type === 'mobius') {
    const [x, y] = point
    const [ar, ai] = /** @type {number[]} */ (operation.a)
    const [br, bi] = /** @type {number[]} */ (operation.b)
    const [cr, ci] = /** @type {number[]} */ (operation.c)
    const [dr, di] = /** @type {number[]} */ (operation.d)
    const nr = ar * x - ai * y + br, ni = ar * y + ai * x + bi
    const qr = cr * x - ci * y + dr, qi = cr * y + ci * x + di
    const denominator = qr * qr + qi * qi
    if (!Number.isFinite(denominator) || denominator < 1e-24) return null
    return [(nr * qr + ni * qi) / denominator, (ni * qr - nr * qi) / denominator]
  }
  return null
}

/** Apply a whole chain, first operation first. @param {Chain} chain @param {Point} point @returns {Point | null} */
export function applyChain(chain, point) {
  let current = point
  for (const operation of chain) {
    const next = applyOperation(operation, current)
    if (!next) return null
    current = next
  }
  return current
}

/** The source-control hull of a path, [x0, y0, x1, y1]. @param {{ points: Point[] }} path */
function pathBox(path) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of path.points) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

/** @param {number[]} box @param {number} a @param {number} b @param {number} c @returns {boolean} */
function lineMeetsBox(box, a, b, c) {
  // The line a x + b y + c = 0 meets a convex box iff the values at its corners do not all share a sign.
  const values = [[box[0], box[1]], [box[0], box[3]], [box[2], box[1]], [box[2], box[3]]].map(([x, y]) => a * x + b * y + c)
  return values.some(value => value === 0) || !values.every(value => value > 0) && !values.every(value => value < 0)
}

/** Check that a nonlinear operation has no pole over a source box. @param {Operation} operation @param {number[]} box */
function poleOutside(operation, box) {
  if (operation.type === 'projective') {
    const m = /** @type {number[]} */ (operation.matrix)
    // W(x,y) = m[6] x + m[7] y + m[8]
    if (lineMeetsBox(box, m[6], m[7], m[8])) throw new TransformError('pole', 'the projective pole crosses the drawing')
    return
  }
  if (operation.type === 'mobius') {
    const [cr, ci] = /** @type {number[]} */ (operation.c)
    const [dr, di] = /** @type {number[]} */ (operation.d)
    if (cr === 0 && ci === 0) return
    const denominator = cr * cr + ci * ci
    const px = (-dr * cr - di * ci) / denominator
    const py = (dr * ci - di * cr) / denominator
    // z = -d/c: (dr + i di) / (cr + i ci)
    if (!Number.isFinite(px) || !Number.isFinite(py)) throw new TransformError('pole', 'the Möbius pole is not finite')
    if (px >= box[0] && px <= box[2] && py >= box[1] && py <= box[3]) throw new TransformError('pole', 'the Möbius pole crosses the drawing')
  }
}

/** @typedef {{ type: 'M' | 'L', p: Point } | { type: 'Q', p: Point, c: Point, end: Point } | { type: 'C', p: Point, c1: Point, c2: Point, end: Point } | { type: 'Z', p: Point, start: Point }} Segment */
/** @typedef {{ segments: Segment[], points: Point[] }} Path */

/** Parse the absolute M, L, Q, C and Z subset a document geometry uses. @param {string} d @returns {Path} */
export function parsePath(d) {
  /** @type {Segment[]} */
  const segments = []
  /** @type {Point[]} */
  const points = []
  let current = /** @type {Point} */ ([0, 0])
  let start = /** @type {Point} */ ([0, 0])
  let command = ''
  /** @type {number[]} */
  let values = []
  let at = 0
  const process = () => {
    if (!command) return
    if (command === 'Z') {
      if (values.length) throw new TransformError('path', 'Z takes no numbers')
      segments.push({ type: 'Z', p: current, start }); current = start; command = ''; values = []; return
    }
    if (command === 'M' || command === 'L') {
      if (values.length < 2 || values.length % 2) throw new TransformError('path', `${command} needs coordinate pairs`)
      for (let i = 0; i < values.length; i += 2) {
        const point = /** @type {Point} */ ([values[i], values[i + 1]])
        if (command === 'M' && i === 0) { start = point; segments.push({ type: 'M', p: point }) }
        else segments.push({ type: 'L', p: point })
        points.push(point); current = point
      }
    } else {
      const size = command === 'Q' ? 4 : 6
      if (!values.length || values.length % size) throw new TransformError('path', `${command} needs ${size} numbers`)
      for (let i = 0; i < values.length; i += size) {
        if (command === 'Q') {
          const c = /** @type {Point} */ ([values[i], values[i + 1]]), end = /** @type {Point} */ ([values[i + 2], values[i + 3]])
          segments.push({ type: 'Q', p: current, c, end }); points.push(c, end); current = end
        } else {
          const c1 = /** @type {Point} */ ([values[i], values[i + 1]]), c2 = /** @type {Point} */ ([values[i + 2], values[i + 3]]), end = /** @type {Point} */ ([values[i + 4], values[i + 5]])
          segments.push({ type: 'C', p: current, c1, c2, end }); points.push(c1, c2, end); current = end
        }
      }
    }
    command = ''; values = []
  }
  while (at < d.length) {
    const char = d[at]
    if (/[\s,]/.test(char)) { at++; continue }
    if (/[A-Za-z]/.test(char)) {
      process()
      if (!'MLQCZ'.includes(char)) throw new TransformError('path', `unsupported path command ${char}`)
      command = char; at++
      continue
    }
    if (!command) throw new TransformError('path', 'path data starts with a number')
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(at))
    if (!match) throw new TransformError('path', `unreadable path data at ${at}`)
    values.push(Number(match[0])); at += match[0].length
  }
  process()
  return { segments, points }
}

/** @param {number} value */
const number = value => {
  const text = value.toFixed(3)
  return text.replace(/\.?0+$/, '') || '0'
}
/** @param {Point} point @param {(point: Point) => Point | null} map @returns {Point} */
const mapped = (point, map) => {
  const next = map(point)
  if (!next || !Number.isFinite(next[0]) || !Number.isFinite(next[1])) throw new TransformError('pole', 'the transform sends the path to infinity')
  return next
}
/** @param {Point} point */
const pointText = point => `${number(point[0])} ${number(point[1])}`

/** The distance from `p` to the segment `a`-`b`. @param {Point} p @param {Point} a @param {Point} b */
function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const length = dx * dx + dy * dy
  if (length < 1e-24) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** @param {Point} a @param {Point} b @returns {Point} */
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/** Flatten a source line after `map`, keeping the mapped midpoint within `tolerance` of the chord.
 *  @param {Point} p0 @param {Point} p1 @param {(point: Point) => Point | null} map @param {number} tolerance @param {Point[]} out @param {number} depth */
function flattenLine(p0, p1, map, tolerance, out, depth) {
  const q0 = mapped(p0, map), q1 = mapped(p1, map), qm = mapped(midpoint(p0, p1), map)
  if (distanceToSegment(qm, q0, q1) <= tolerance) { out.push(q1); return }
  if (depth >= 18) throw new TransformError('precision', 'the line does not flatten within the work limit')
  const middle = midpoint(p0, p1)
  flattenLine(p0, middle, map, tolerance, out, depth + 1)
  flattenLine(middle, p1, map, tolerance, out, depth + 1)
}

/** Flatten a quadratic after `map`, checking the mapped curve's own midpoint.
 *  @param {Point} p0 @param {Point} c @param {Point} p2 @param {(point: Point) => Point | null} map @param {number} tolerance @param {Point[]} out @param {number} depth */
function flattenQuadratic(p0, c, p2, map, tolerance, out, depth) {
  const q0 = mapped(p0, map), q2 = mapped(p2, map)
  const samples = [0.25, 0.5, 0.75].map(t => {
    const u = 1 - t
    const point = /** @type {Point} */ ([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]])
    return mapped(point, map)
  })
  if (samples.every(point => distanceToSegment(point, q0, q2) <= tolerance)) { out.push(q2); return }
  if (depth >= 18) throw new TransformError('precision', 'the curve does not flatten within the work limit')
  const p01 = midpoint(p0, c), p12 = midpoint(c, p2), p012 = midpoint(p01, p12)
  flattenQuadratic(p0, p01, p012, map, tolerance, out, depth + 1)
  flattenQuadratic(p012, p12, p2, map, tolerance, out, depth + 1)
}

/** Flatten a cubic after `map`, checking the mapped curve's own midpoint.
 *  @param {Point} p0 @param {Point} c1 @param {Point} c2 @param {Point} p3 @param {(point: Point) => Point | null} map @param {number} tolerance @param {Point[]} out @param {number} depth */
function flattenCubic(p0, c1, c2, p3, map, tolerance, out, depth) {
  if (depth >= 18) throw new TransformError('precision', 'the curve does not flatten within the work limit')
  const q0 = mapped(p0, map), q3 = mapped(p3, map)
  const samples = [0.25, 0.5, 0.75].map(t => {
    const u = 1 - t
    const point = /** @type {Point} */ ([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
    ])
    return mapped(point, map)
  })
  if (samples.every(point => distanceToSegment(point, q0, q3) <= tolerance)) { out.push(q3); return }
  const p01 = midpoint(p0, c1), p12 = midpoint(c1, c2), p23 = midpoint(c2, p3)
  const p012 = midpoint(p01, p12), p123 = midpoint(p12, p23), p0123 = midpoint(p012, p123)
  flattenCubic(p0, p01, p012, p0123, map, tolerance, out, depth + 1)
  flattenCubic(p0123, p123, p23, p3, map, tolerance, out, depth + 1)
}

/** A nonlinear chain split into affine prefix, one nonlinear operation and affine suffix.
 * @param {Chain} chain @returns {{ prefix: Chain, operation: Operation | null, suffix: Chain }} */
function splitChain(chain) {
  const nonlinear = chain.map((operation, index) => ({ operation, index })).filter(({ operation }) => operation.type !== 'affine')
  if (nonlinear.length > 1) throw new TransformError('chain', 'more than one nonlinear operation in a chain')
  if (!nonlinear.length) return { prefix: chain, operation: null, suffix: [] }
  const { operation, index } = nonlinear[0]
  if (!['projective', 'mobius'].includes(operation.type)) throw new TransformError('unknown', `unknown transform operation ${operation.type}`)
  return { prefix: chain.slice(0, index), operation, suffix: chain.slice(index + 1) }
}

/**
 * Transform an SVG path (`M`, `L`, `Q`, `C`, `Z`, absolute) through a chain. Affine chains keep the
 * commands; a chain with one nonlinear operation flattens curves to `tolerance` and rejects a pole
 * over the path's control hull.
 * @param {string} d @param {Chain} chain @param {{ tolerance?: number }} [options]
 * @returns {{ d: string, approximate: boolean }}
 */
export function transformPath(d, chain, { tolerance = 0.1 } = {}) {
  /** @type {Path} */ let path
  try { path = parsePath(d) } catch (error) { if (error instanceof TransformError) throw error; throw new TransformError('path', String(error)) }
  if (!path.segments.length) return { d: '', approximate: false }
  if (chainIsAffine(chain)) {
    const matrix = affineForChain(chain) ?? IDENTITY
    /** @param {Point} point */
    const map = point => applyAffine(matrix, point)
    const out = []
    for (const segment of path.segments) {
      if (segment.type === 'Z') { out.push('Z'); continue }
      if (segment.type === 'M') out.push(`M${pointText(map(segment.p))}`)
      else if (segment.type === 'L') out.push(`L${pointText(map(segment.p))}`)
      else if (segment.type === 'Q') out.push(`Q${pointText(map(segment.c))} ${pointText(map(segment.end))}`)
      else if (segment.type === 'C') out.push(`C${pointText(map(segment.c1))} ${pointText(map(segment.c2))} ${pointText(map(segment.end))}`)
      else throw new TransformError('path', 'unexpected path segment')
    }
    return { d: out.join(''), approximate: false }
  }
  const { prefix, operation, suffix } = splitChain(chain)
  if (!operation) throw new TransformError('chain', 'nonlinear chain without a nonlinear operation')
  const prefixMatrix = affineProduct(prefix), suffixMatrix = affineProduct(suffix)
  poleOutside(operation, pathBox({ points: path.points.map(point => applyAffine(prefixMatrix, point)) }))
  /** @param {Point} point */
  const map = point => {
    const before = applyAffine(prefixMatrix, point)
    const middle = applyOperation(operation, before)
    return middle ? applyAffine(suffixMatrix, middle) : null
  }
  const out = []
  let current = /** @type {Point} */ ([0, 0])
  for (const segment of path.segments) {
    if (segment.type === 'M') { current = segment.p; out.push(`M${pointText(mapped(segment.p, map))}`); continue }
    if (segment.type === 'L') {
      const points = /** @type {Point[]} */ ([])
      flattenLine(current, segment.p, map, tolerance, points, 0)
      for (const point of points) out.push(`L${pointText(point)}`)
      current = segment.p
      continue
    }
    if (segment.type === 'Q') {
      const points = /** @type {Point[]} */ ([])
      flattenQuadratic(current, segment.c, segment.end, map, tolerance, points, 0)
      for (const point of points) out.push(`L${pointText(point)}`)
      current = segment.end
      continue
    }
    if (segment.type === 'C') {
      const points = /** @type {Point[]} */ ([])
      flattenCubic(current, segment.c1, segment.c2, segment.end, map, tolerance, points, 0)
      for (const point of points) out.push(`L${pointText(point)}`)
      current = segment.end
      continue
    }
    // Z: the closing edge is a line too under a nonlinear map.
    if (segment.type !== 'Z') throw new TransformError('path', 'unexpected path segment')
    const points = /** @type {Point[]} */ ([])
    flattenLine(current, segment.start, map, tolerance, points, 0)
    for (const point of points) out.push(`L${pointText(point)}`)
    out.push('Z')
    current = segment.start
  }
  return { d: out.join(''), approximate: true }
}

/** Transform local geometry pieces. @param {Piece[]} pieces @param {Chain} chain @param {{ tolerance?: number }} [options] */
export function transformPieces(pieces, chain, options) {
  return pieces.map(piece => {
    const transformed = transformPath(piece.d, chain, options)
    return { ...piece, d: transformed.d, approximate: transformed.approximate }
  })
}
