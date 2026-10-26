import { describe, expect, it } from 'bun:test'
import {
  IDENTITY, TransformError, affineForChain, applyAffine, applyChain, applyOperation, chainIsAffine,
  multiplyAffine, parsePath, transformPath, transformPieces,
} from '../src/document/index.js'

const close = (a, b, digits = 9) => expect(a.map(v => Number(v.toFixed(digits)))).toEqual(b.map(v => Number(v.toFixed(digits))))

describe('affine matrices', () => {
  it('composes in application order and maps points', () => {
    const move = [1, 0, 0, 1, 10, 0], scale = [2, 0, 0, 2, 0, 0]
    const both = multiplyAffine(scale, move)
    close(applyAffine(both, [1, 2]), [22, 4])
    const chain = [{ type: 'affine', matrix: move }, { type: 'affine', matrix: scale }]
    expect(chainIsAffine(chain)).toBe(true)
    close(applyAffine(affineForChain(chain), [1, 2]), [22, 4])
    close(applyChain(chain, [1, 2]), [22, 4])
  })
  it('leaves the identity alone', () => {
    close(applyAffine(IDENTITY, [3, 4]), [3, 4])
    expect(affineForChain([])).toEqual(IDENTITY)
  })
})

describe('projective and Möbius maps', () => {
  it('divides projective coordinates by W', () => {
    const point = applyOperation({ type: 'projective', matrix: [1, 0, 0, 0, 1, 0, 0.001, 0, 1] }, [100, 200])
    close(/** @type {number[]} */ (point), [100 / 1.1, 200 / 1.1])
  })
  it('maps a point by a Möbius transformation', () => {
    // z' = 1 / z
    const point = applyOperation({ type: 'mobius', a: [0, 0], b: [1, 0], c: [1, 0], d: [0, 0] }, [2, 1])
    close(/** @type {number[]} */ (point), [0.4, -0.2])
  })
  it('returns null at a pole and for an unknown operation', () => {
    expect(applyOperation({ type: 'mobius', a: [1, 0], b: [0, 0], c: [1, 0], d: [0, 0] }, [0, 0])).toBeNull()
    expect(applyOperation({ type: 'example.org/warp' }, [1, 2])).toBeNull()
  })
})

describe('path parsing', () => {
  it('reads absolute commands, exponent numbers and repeated groups', () => {
    const path = parsePath('M0 0L10-5Q20 0 20 10C21 11 22 12 23 13Z')
    expect(path.segments.map(segment => segment.type)).toEqual(['M', 'L', 'Q', 'C', 'Z'])
    expect(path.segments[1]).toEqual({ type: 'L', p: [10, -5] })
    expect(parsePath('M1e1 2e1L3 4').segments[0]).toEqual({ type: 'M', p: [10, 20] })
    expect(parsePath('M0 0 10 10').segments.map(segment => segment.type)).toEqual(['M', 'L'])
    expect(parsePath('M0 0Q10 0 20 0 30 0 40 0').segments.filter(segment => segment.type === 'Q')).toHaveLength(2)
  })
  it('rejects relative, unknown and incomplete commands', () => {
    expect(() => parsePath('m0 0l10 10')).toThrow(TransformError)
    expect(() => parsePath('M0 0H10')).toThrow(TransformError)
    expect(() => parsePath('M0 0L10')).toThrow(TransformError)
    expect(() => parsePath('M0 0Z1')).toThrow(TransformError)
  })
})

describe('transformPath', () => {
  const square = 'M0 0L100 0L100 100L0 100Z'
  it('keeps affine paths exact', () => {
    const result = transformPath(square, [{ type: 'affine', matrix: [1, 0, 0, 1, 10, 20] }])
    expect(result.approximate).toBe(false)
    expect(result.d).toBe('M10 20L110 20L110 120L10 120Z')
  })
  it('keeps curves exact through affine transforms', () => {
    const result = transformPath('M0 0Q10 0 20 10Z', [{ type: 'affine', matrix: [2, 0, 0, 2, 0, 0] }])
    expect(result.d).toBe('M0 0Q20 0 40 20Z')
  })
  it('flattens a nonlinear path and certifies a pole outside its control hull', () => {
    const far = transformPath('M1 1L2 1L2 2L1 2Z', [{ type: 'mobius', a: [0, 0], b: [1, 0], c: [1, 0], d: [0, 0] }])
    expect(far.approximate).toBe(true)
    expect(far.d).not.toContain('Q')
    expect(far.d).not.toContain('C')
    expect(far.d).toStartWith('M0.5')
  })
  it('flattens straight edges and closing edges under a nonlinear map', () => {
    const inversion = { type: 'mobius', a: [0, 0], b: [1, 0], c: [1, 0], d: [0, 0] }
    const line = transformPath('M-1 1L1 1', [inversion], { tolerance: 0.01 })
    expect(line.approximate).toBe(true)
    const points = parsePath(line.d).points
    expect(points.length).toBeGreaterThan(2)
    expect(points.some(([x, y]) => Math.hypot(x - 0, y + 1) < 0.1)).toBe(true)
    const closed = transformPath('M1 1L2 1L2 2L1 2Z', [inversion], { tolerance: 0.01 })
    expect(parsePath(closed.d).segments.filter(segment => segment.type === 'L').length).toBeGreaterThanOrEqual(8)
  })
  it('samples the curve itself, not its transformed control points', () => {
    const inversion = { type: 'mobius', a: [0, 0], b: [1, 0], c: [1, 0], d: [0, 0] }
    const result = transformPath('M1 0Q0.5 0.5 0.2 0.4', [inversion], { tolerance: 0.01 })
    const points = parsePath(result.d).points
    expect(points.some(([x, y]) => Math.hypot(x - 1.2941176470588236, y + 0.8235294117647057) < 0.1)).toBe(true)
  })
  it('keeps a curve that doubles back along its chord', () => {
    const identity = { type: 'projective', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
    const result = transformPath('M0 0Q100 0 1 0', [identity], { tolerance: 0.1 })
    const points = parsePath(result.d).points
    expect(Math.max(...points.map(([x]) => x))).toBeGreaterThan(40)
  })
  it('applies affine operations before and after one nonlinear operation', () => {
    const inversion = { type: 'mobius', a: [0, 0], b: [1, 0], c: [1, 0], d: [0, 0] }
    const result = transformPath('M2 1L3 1', [
      { type: 'affine', matrix: [1, 0, 0, 1, 0, 0] },
      inversion,
      { type: 'affine', matrix: [1, 0, 0, 1, 10, 20] },
    ], { tolerance: 0.01 })
    const first = parsePath(result.d).points[0]
    expect(first[0]).toBeCloseTo(10.4, 6)
    expect(first[1]).toBeCloseTo(19.8, 6)
  })
  it('refuses a Möbius pole inside the control hull', () => {
    expect(() => transformPath(square, [{ type: 'mobius', a: [1, 0], b: [0, 0], c: [1, 0], d: [0, 0] }])).toThrow('pole')
  })
  it('refuses a projective pole line across the box', () => {
    expect(() => transformPath(square, [{ type: 'projective', matrix: [1, 0, 0, 0, 1, 0, 0.01, 0, -0.5] }])).toThrow('pole')
  })
  it('refuses more than one nonlinear operation and unknown operations', () => {
    const mobius = { type: 'mobius', a: [1, 0], b: [0, 0], c: [0.001, 0], d: [1, 0] }
    expect(() => transformPath(square, [mobius, mobius])).toThrow('more than one nonlinear')
    expect(() => transformPath(square, [{ type: 'example.org/warp' }])).toThrow('unknown transform')
  })
  it('transforms pieces and keeps their fill and cut roles', () => {
    const pieces = [{ d: square, fillRule: 'evenodd', cut: true }]
    const out = transformPieces(pieces, [{ type: 'affine', matrix: [1, 0, 0, 1, 1, 1] }])
    expect(out[0]).toMatchObject({ fillRule: 'evenodd', cut: true })
    expect(out[0].d).toStartWith('M1 1')
  })
})
