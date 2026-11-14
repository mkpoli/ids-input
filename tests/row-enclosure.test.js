// A row that writes an enclosing description keeps the row's layout: the enclosure takes its share
// of the cell and frames its own operand, instead of a host's cut of the whole row setting the
// donor's frame and the partner's column. The export is the small fixture's, with a fixed row split.
import { describe, expect, it } from 'bun:test'
import { Composer } from '@han-compose/composer/compose'
import { compose, createSource } from '@han-compose/composer/loader'
import { files, layout, ops, shards } from './fixtures/composer-export.js'

const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const box = (x0, y0, x1, y1) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]
const glyphOf = boxes => ({
  v: 1,
  b: [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))],
  p: boxes.map(b => box(...b)),
})
const character = (key, boxes) => ({ k: key, G: glyphOf(boxes), ink: boxes.reduce((s, [x0, y0, x1, y1]) => s + 2 * (x1 - x0 + y1 - y0), 0), nl: boxes.length, o: boxes.length })

// A 冂 frame, the two dots of ⺀ and the two strokes of 刂, each as its own glyph.
const FRAME = [[100, 700, 900, 800], [100, 0, 180, 800], [820, 0, 900, 800]]
const DOTS = [[300, 400, 420, 480], [500, 200, 620, 280]]
const KNIFE = [[600, 100, 680, 800], [600, 20, 850, 100]]
const ROW = ['⿰', ['⿵', '冂', '⺀'], '刂']
const ROW_KEY = '⿰⿵冂⺀刂', ENCLOSURE = '⿵冂⺀'

// A layout that puts a row's operands in fixed left and right boxes, whatever they are.
const LEFT = [40, -80, 440, 840], RIGHT = [560, -80, 960, 840]
const fixed = { ...layout, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') },
  Buffer.from(Float32Array.from([...LEFT, ...RIGHT].map(v => v / 1000)).buffer).toString('base64')]] }
// The donor's row frame and the boxes its operands took there, narrower and further out than the
// learned boxes: a drawing that follows the donor's share shows which layout ran.
const DONOR = [100, -80, 900, 840], DONOR_LEFT = [100, -80, 400, 840], DONOR_RIGHT = [600, -80, 900, 840]
const KNIFE_CUT = [[100, -80, 200, 840], [300, -80, 400, 840], [600, -80, 700, 840], [800, -80, 900, 840], [600, 700, 900, 840], [100, 700, 400, 840]].map(b => box(...b))

const extra = {
  ...shards('g', [
    ['冂', character('冂', FRAME)],
    ['⺀', character('⺀', DOTS)],
    ['刂', character('刂', KNIFE)],
    [ENCLOSURE, { k: ENCLOSURE, P: ['L'] }],
    [ROW_KEY, { k: ROW_KEY, P: ['R'] }],
  ]),
  // A donor's whole left piece and a donor's whole row, each with enough contours to be taken.
  ...shards('p', [
    [`L\t${ENCLOSURE}`, [{ h: '剪', op: '⿰', ok: ['刂'], d: 1, j: 1, v: 1, r: 0, si: 2000, fr: DONOR,
      b: DONOR_LEFT, p: [box(100, -80, 200, 840), box(300, -80, 400, 840), box(100, 700, 400, 840)] }]],
    [`R\t${ROW_KEY}`, [{ h: '剪', op: '⿰', ok: ['⿵冂⺀'], d: 1, j: 1, v: 1, r: 0, si: 2000, fr: DONOR,
      b: DONOR_RIGHT, p: KNIFE_CUT }]],
    [`R\t刂`, [{ h: '剪', op: '⿰', ok: ['⿵冂⺀'], d: 1, j: 1, v: 1, r: 0, si: 2000, fr: DONOR,
      b: DONOR_RIGHT, p: KNIFE_CUT }]],
  ]),
}

const sourceOf = () => createSource(async name => {
  if (name === 'layout.json') return new Uint8Array(Buffer.from(JSON.stringify(fixed))).buffer
  const body = extra[name] ?? files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})

describe('a row writing an enclosure', () => {
  it('is laid out by its own row split, the enclosure framing its operand', async () => {
    const source = sourceOf()
    await source.ready()
    const composer = new Composer(source.store())
    expect(composer.rowHoldsEnclosure(ROW)).toBe(true)
    expect(composer.rowHoldsEnclosure(['⿱', ['⿵', '冂', '⺀'], '刂'])).toBe(false)
    expect(composer.rowHoldsEnclosure(['⿰', '木', '口'])).toBe(false)

    const drawing = await compose(source, ROW_KEY)
    // Neither the donor's left piece nor the donor's whole row replaces the row; the enclosure is
    // drawn from 冂 and ⺀ and the 刂 stands in the right share of the row.
    expect(drawing.origins).toContain('glyph 冂')
    expect(drawing.origins).toContain('glyph ⺀')
    expect(drawing.origins).toContain('glyph 刂')
    expect(drawing.origins.some(origin => origin.startsWith('learned') || origin.startsWith('instance'))).toBe(false)
    const frame = drawing.parts.find(part => part.origin === 'glyph 冂')
    const knife = drawing.parts.find(part => part.origin === 'glyph 刂')
    // The donor's row frame sets the row: a 300-wide enclosure and the 刂 from x 600, not the
    // learned boxes' 400 and 560.
    expect(frame.box[2]).toBeLessThan(350)
    expect(knife.box[0]).toBeGreaterThan(590)
  })
})
