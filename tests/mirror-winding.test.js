import { describe, expect, it } from 'bun:test'
import { commands, pathRings, placed, svgPath } from '../src/composer/geometry.js'

/** A part of one contour in font units, placed onto itself unless `from` and `to` say otherwise. */
const part = (ops, points, { from = [0, 0, 1000, 1000], to = [0, 0, 1000, 1000] } = {}) => placed(
  { contours: [{ ops: commands(ops), light: Float64Array.from(points), heavy: Float64Array.from(points) }] },
  from, to, 1000,
)
const square = (x0, y0, x1, y1) => part('MLLL', [x0, y0, x1, y0, x1, y1, x0, y1])
const area = ring => {
  let sum = 0
  for (let i = 0; i < ring.length; i += 2) {
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], y1 = ring[(i + 3) % ring.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}
/** The nonzero winding number of a point, as the browser fills the path. */
const winding = (rings, px, py) => rings.reduce((sum, ring) => {
  let count = 0
  for (let i = 0; i < ring.length; i += 2) {
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], y1 = ring[(i + 3) % ring.length]
    const side = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)
    if (y0 <= py ? y1 > py && side > 0 : y1 <= py && side < 0) count++
  }
  return sum + count
}, 0)
const mirror = about => ({ x: true, about })
const turn = about => ({ x: true, y: true, about })

describe('a mirrored part', () => {
  it('is wound the way the parts it is drawn with are', () => {
    const plain = pathRings(svgPath([square(0, 0, 500, 800)]))[0]
    const mirrored = pathRings(svgPath([{ ...square(0, 0, 500, 800), flips: [mirror([500, 400])] }]))[0]
    expect(Math.sign(area(plain))).toBe(Math.sign(area(mirrored)))
    expect(Math.abs(area(mirrored))).toBe(Math.abs(area(plain)))
  })
  it('fills the ink it overlaps instead of cancelling it', () => {
    const left = square(0, 0, 500, 800)
    const right = square(400, 0, 900, 800)
    expect(winding(pathRings(svgPath([left, right])), 450, 400)).toBe(2)
    expect(winding(pathRings(svgPath([left, { ...right, flips: [mirror([650, 400])] }])), 450, 400)).toBe(2)
  })
  it('is left wound as it was by a half turn', () => {
    const right = square(400, 0, 900, 800)
    expect(area(pathRings(svgPath([{ ...right, flips: [turn([650, 400])] }]))[0])).toBeGreaterThan(0)
  })
  it('turns a curve round without moving it', () => {
    const curved = part('MLQ2Q2', [0, 0, 0, 800, 700, 800, 700, 0, 700, 0, 0, 0])
    const ring = pathRings(svgPath([curved]))[0]
    const flipped = pathRings(svgPath([{ ...curved, flips: [mirror([500, 400])] }]))[0]
    expect(Math.sign(area(flipped))).toBe(Math.sign(area(ring)))
    expect(Math.abs(area(flipped))).toBeCloseTo(Math.abs(area(ring)), 3)
    expect(Math.min(...ring.filter((_, i) => i % 2 === 0))).toBe(0)
    expect(Math.min(...flipped.filter((_, i) => i % 2 === 0))).toBeCloseTo(300, 6)
  })
})
