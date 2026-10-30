import { describe, expect, it } from 'bun:test'
import { commands, drawnContours, makePart, pathRings, placed, pointsBox, svgPath } from '../src/composer/geometry.js'
import { pressedEnclosure as press } from '../src/composer/compose.js'

/** A contour in font units, y up. */
const contour = (ops, points, width = null) => ({ ops: commands(ops), light: Float64Array.from(points), heavy: Float64Array.from(points), width })
/** A box drawn clockwise, as the fonts draw an outline. */
const clockwise = (x0, y0, x1, y1, width = null) => contour('MLLL', [x0, y0, x0, y1, x1, y1, x1, y0], width)
/** A box drawn counter-clockwise, as the fonts draw a counter. */
const counter = (x0, y0, x1, y1) => contour('MLLL', [x0, y0, x1, y0, x1, y1, x0, y1])
/** The winding number of a point, as the browser fills the path. */
const winding = (rings, px, py) => rings.reduce((sum, ring) => {
  let count = 0
  for (let i = 0; i < ring.length; i += 2) {
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], y1 = ring[(i + 3) % ring.length]
    const side = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)
    if (y0 <= py && y1 > py && side > 0) count++
    else if (y0 > py && y1 <= py && side < 0) count--
  }
  return sum + count
}, 0)

/** Klee One's 电: one outline of the 日 frame and the 乚, with four window counters inside it. */
const kekki = () => makePart([
  clockwise(0, 0, 1000, 800, [50, 40]),
  counter(200, 200, 400, 380),
  counter(500, 200, 700, 380),
  counter(200, 420, 400, 600),
  counter(500, 420, 700, 600),
])
const stood = part => placed(part, part.box, part.box, 1000)

describe('a glyph drawn as one outline with its counters', () => {
  it('presses its box and draws its foot out, keeping the counters inside the outline', () => {
    const glyph = stood(kekki())
    const pressed = press(glyph, 0)
    expect(pressed).not.toBeNull()
    const rings = pathRings(svgPath([pressed]))
    // Counters keep their order and stay within the pressed box: the box's right edge sits at
    // 0.485 of the width, and the foot still ends at the right edge.
    const xs = pressed.part.contours.map(c => pointsBox(c.light))
    expect(Math.max(...xs.slice(1).map(b => b[2]))).toBeCloseTo(0.485 * 700 / 900 * 1000, 1)
    expect(xs[0][2]).toBeCloseTo(1000, 6)
    // The windows are holes: the outline runs clockwise, the counters the other way.
    for (const [x, y] of [[160, 290], [320, 290], [160, 510], [320, 510]]) expect(winding(rings, x, y)).toBe(0)
    expect(winding(rings, 100, 100)).toBe(-1)
  })
  it('presses in the glyph\'s own coordinates, so a fitted placement keeps the share', () => {
    const glyph = makePart([
      clockwise(0, 0, 1000, 800, [50, 40]),
      counter(200, 200, 400, 380),
      counter(500, 200, 700, 380),
      counter(200, 420, 400, 600),
      counter(500, 420, 700, 600),
    ])
    const target = [100, 50, 600, 450], drawn = drawnContours(press(placed(glyph, glyph.box, target, 1000), 0))
    const boxes = drawn.map(pointsBox)
    // The foot ends at the target's right edge; the box's right edge (the frame, one left-frame
    // thickness past the counters) keeps 0.485 of the placed width, and the counters sit inside it.
    expect(Math.max(...boxes.map(b => b[2]))).toBeCloseTo(600, 6)
    expect(Math.max(...boxes.slice(1).map(b => b[2]))).toBeCloseTo(100 + 500 * 0.485 * 700 / 900, 1)
    expect(Math.max(...boxes.slice(1).map(b => b[2]))).toBeLessThan(100 + 500 * 0.485)
  })
  it('is left alone when it has no separate counters to press', () => {
    const glyph = stood(makePart([clockwise(0, 0, 1000, 800, [50, 40])]))
    expect(press(glyph, 0)).toBeNull()
  })
})
