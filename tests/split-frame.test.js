import { describe, expect, it } from 'bun:test'
import { commands, derived, makePart } from '../src/composer/geometry.js'
import { Composer } from '../src/composer/compose.js'
import constants from '../src/composer/constants.json' with { type: 'json' }

/** A contour in font units, y up: a box drawn clockwise, as the fonts draw an outline. */
const box = (x0, y0, x1, y1) => ({
  ops: commands('MLLL'),
  light: Float64Array.from([x0, y0, x0, y1, x1, y1, x1, y0]),
  heavy: Float64Array.from([x0, y0, x0, y1, x1, y1, x1, y0]),
  width: null,
})

describe('a frame cut down the middle', () => {
  it('splits the contours at the middle of the glyph, keeping each side whole', () => {
    // 𦥑's two halves: a left column and a right column, far apart.
    const glyph = makePart([box(0, 0, 300, 800), box(700, 0, 1000, 800)])
    const middle = (glyph.box[0] + glyph.box[2]) / 2
    const pieces = glyph.contours.map((_, i) => derived(glyph, [glyph.contours[i]]))
    const left = [], right = []
    pieces.forEach((piece, i) => ((piece.box[0] + piece.box[2]) / 2 < middle ? left : right).push(i))
    expect(left).toEqual([0])
    expect(right).toEqual([1])
    expect(derived(glyph, left.map(i => glyph.contours[i])).box).toEqual([0, 0, 300, 800])
    expect(derived(glyph, right.map(i => glyph.contours[i])).box).toEqual([700, 0, 1000, 800])
  })

  it('keeps the enclosed part clear of the right half, as 學 and 覺 set it', () => {
    // 𦥑's halves and the part between them: the right half opens with its bars a little inside its
    // column, so the part keeps a wider clearance there than on the left.
    const glyph = makePart([box(0, 0, 300, 800), box(700, 0, 1000, 800)])
    const region = [0, 0, 1000, 1000]
    const frame = Composer.prototype.frameHalves.call({ C: constants, ink: () => 1000 }, glyph, '𦥑', region)
    expect(frame.room[0]).toBeCloseTo(252, 0)
    expect(frame.room[2]).toBeCloseTo(718, 0)
  })
})
