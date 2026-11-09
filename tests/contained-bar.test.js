// 丑's third stroke: the fonts the composer draws from run its middle horizontal out past the
// right vertical. The drawing ends that bar inside the vertical, as the textbooks draw it, both
// when the character comes from its own glyph and when it comes from a host cut.
import { describe, expect, it } from 'bun:test'
import { BAR_FROM, Composer } from '../src/composer/compose.js'
import { pointsBox } from '../src/composer/geometry.js'
import { compose, createSource } from '../src/composer/loader.js'
import { files, shards } from './fixtures/composer-export.js'

const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const outline = ([x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(value => value * 4)), int16(Array(8).fill(0))]
const glyph = (box, outlines) => ({ v: 1, b: box, p: outlines })
const record = (key, box, outlines) => ({ k: key, G: glyph(box, outlines), ink: 8573, nl: outlines.length, o: outlines.length })

/** 丑 as the fonts draw it: the middle bar reaches past the right vertical (to 950 here). */
const CHOU = [
  outline([136, 701, 739, 775]), // top bar
  outline([62, -49, 938, 23]), // bottom bar
  outline([52, 350, 950, 424]), // middle bar, out past the right vertical
  outline([247, -4, 423, 738]), // left vertical
  outline([651, -8, 783, 775]), // right vertical
]

/** The same bars with a 丑 cut out of 峱, whose middle bar runs out further still. */
const SHAN = [outline([136, 701, 739, 775]), outline([62, -49, 938, 23]), outline([52, 350, 990, 424]),
  outline([247, -4, 423, 738]), outline([651, -8, 783, 775])]

const sourceOf = extra => createSource(async name => {
  const body = extra[name] ?? files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})

const fixture = () => sourceOf({
  ...shards('g', [['丑', record('丑', [52, -49, 950, 775], CHOU)], ['峱', record('峱', [52, -49, 990, 775], SHAN)]]),
  ...shards('p', [['T\t丑', { hosts: [{ h: '峱', d: '⿰犭⿱丑山', op: '⿱', ok: ['丑'], r: 0, si: 1, v: 1, j: 1,
    c: { k: [0, 1, 2, 3, 4], b: [52, -49, 990, 775], g: 0 } }] }]]),
})

/** The bar boxes of a 丑 piece, bottom first, and the outer edge of its right vertical. */
function bars(part) {
  const boxes = part.contours.map(contour => pointsBox(contour.light))
  const bars = boxes.filter(box => box[2] - box[0] > 5 * (box[3] - box[1])).sort((a, b) => a[1] - b[1])
  const right = boxes.filter(box => box[3] - box[1] > 2 * (box[2] - box[0])).reduce((a, b) => b[2] > a[2] ? b : a)
  return { bars, right }
}

describe("丑's contained middle bar", () => {
  it('ends the middle horizontal at the right vertical in a host cut and in its own glyph', async () => {
    const source = fixture()
    const drawn = await compose(source, '⿱丑丑')
    expect(drawn.origins).toContain('host 峱')
    for (const part of new Composer(source.store()).compose('⿱丑丑')) {
      const { bars: found, right } = bars(part.part)
      expect(found).toHaveLength(3)
      expect(found[1][2]).toBeLessThanOrEqual(right[2])
    }
    // The character on its own keeps the font's drawing: only an operand inside a description is
    // contained, so 丑 stands as the font sets it and ⿱丑丑 as the textbooks do.
    const own = new Composer(source.store()).compose('丑')[0]
    const { bars: ownBars, right: ownRight } = bars(own.part)
    expect(ownBars[1][2]).toBeGreaterThan(ownRight[2])
    // The fallback variant keeps the font's bar inside a composition too.
    const old = new Composer(source.store(), { keepBars: true }).compose('⿱丑丑')[0]
    expect(bars(old.part).bars[1][2]).toBeGreaterThan(950 - 1)
  })

  it('leaves an outline without separate bars as the font draws it', async () => {
    // A brush face draws 丑 as one outline with two counters, so there is no bar to cut.
    const source = sourceOf({ ...shards('g', [['丑', record('丑', [80, -11, 920, 708], [
      outline([80, -11, 920, 708]), outline([418, 390, 682, 663]), outline([369, 41, 655, 358]),
    ])]]) })
    await source.ready()
    await source.load(source.filesOf(['丑']))
    const glyph = new Composer(source.store()).glyph('丑')
    expect(glyph.contours).toHaveLength(3)
    expect(glyph.box).toEqual([80, -11, 920, 708])
    expect(pointsBox(glyph.contours[0].light)).toEqual([80, -11, 920, 708])
  })
})

describe('the middle bar of 丑', () => {
  it('starts where the font starts it and ends at the right vertical', () => {
    // The font draws the bar from 222 to 764 in a glyph spanning 62 to 938: 0.18 of the ink width
    // in, and just short of the right vertical's outer edge.
    expect(BAR_FROM).toBeGreaterThan(0.1)
    expect(BAR_FROM).toBeLessThan(0.3)
  })
})
