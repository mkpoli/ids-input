// Sizing inside a frame: an operand drawn as a grid keeps its rows equal when the frame is too
// small for the whole glyph, and a component cut from a host fills the cell it is given.
import { describe, expect, it } from 'bun:test'
import { compose, createSource } from '@han-compose/composer/loader'
import { Composer } from '@han-compose/composer/compose'
import { commands, makePart, stretchOf } from '@han-compose/composer/geometry'
import { files, layout, ops, shards } from './fixtures/composer-export.js'

const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const boxGlyph = boxes => ({ v: 1,
  b: [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))],
  p: boxes.map(([x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]) })
const character = (key, boxes, { s, ink } = {}) => ({ k: key, G: boxGlyph(boxes), ink: ink ?? boxes.reduce((sum, [x0, y0, x1, y1]) => sum + 2 * (x1 - x0 + y1 - y0), 0),
  nl: boxes.length, o: boxes.length, ...(s ? { s } : {}) })

// 冂 as a frame of three bars, and 㸚 as a coarse 2 × 2 grid whose top row is drawn small: the
// shape of the font glyph that overflows 冂.
const RECORDS = {
  冂: character('冂', [[60, 0, 150, 800], [850, 0, 940, 800], [60, 720, 940, 800]]),
  㸚: character('㸚', [[100, 500, 480, 620], [520, 500, 900, 620], [100, 100, 480, 480], [520, 100, 900, 480]],
    { s: '⿱⿰㐅㐅⿰㐅乂' }),
  㐅: character('㐅', [[100, 100, 900, 900]], { ink: 4000 }),
  乂: character('乂', [[100, 100, 900, 900]], { ink: 4800 }),
  木: character('木', [[100, -60, 900, 0], [470, -80, 530, 820]]),
  穴: character('穴', [[100, 100, 900, 900]], { ink: 5727 }),
  又: character('又', [[100, 100, 900, 900]], { ink: 6262 }),
  𠆢: character('𠆢', [[100, 100, 900, 900]], { ink: 2448 }),
}
const SHARDS = shards('g', Object.entries(RECORDS))
const constants = JSON.parse(files['manifest.json']).constants
// A layout that gives the inner operand nearly the whole face, larger than the opening the frame
// leaves: the frame is drawn around its region and the inner overflows it, as ⿵冂㸚 does.
const layoutWith = boxes => ({ ...layout, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') },
  Buffer.from(Float32Array.from(boxes.map(v => v / 1000)).buffer).toString('base64')]] })
const sourceWith = drawing => createSource(async name => {
  if (name === 'layout.json') return new Uint8Array(Buffer.from(JSON.stringify(layoutWith(drawing)))).buffer
  if (name === 'manifest.json') return new Uint8Array(Buffer.from(files['manifest.json'])).buffer
  const body = SHARDS[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})
const source = sourceWith([40, -80, 960, 840, -20, -80, 1020, 840])

describe('a grid operand inside a frame', () => {
  it('draws the description in equal cells when the whole glyph is larger than the opening', async () => {
    const drawn = await compose(source, '⿵冂㸚')
    const [frame, ...cells] = drawn.parts
    expect(cells).toHaveLength(4)
    expect(cells.map(part => part.origin)).toEqual(['cells 㐅', 'cells 㐅', 'cells 㐅', 'cells 乂'])
    // Two rows of equal height: the top row is no longer the small one.
    expect(cells[0].box[3]).toBeCloseTo(cells[2].box[3], 6)
    expect(cells[0].box[1]).toBeCloseTo(cells[1].box[1], 6)
    expect(cells[2].box[1]).toBeCloseTo(cells[3].box[1], 6)
    expect(cells[2].box[1]).toBeGreaterThan(cells[0].box[1] + cells[0].box[3] / 2)
    // All four stay inside the frame.
    for (const cell of cells) {
      expect(cell.box[0]).toBeGreaterThanOrEqual(frame.box[0])
      expect(cell.box[1]).toBeGreaterThanOrEqual(frame.box[1])
      expect(cell.box[0] + cell.box[2]).toBeLessThanOrEqual(frame.box[0] + frame.box[2])
      expect(cell.box[1] + cell.box[3]).toBeLessThanOrEqual(frame.box[1] + frame.box[3])
    }
    expect(drawn.cells).toBeUndefined()
  })

  it('keeps a whole glyph that is no grid', async () => {
    const drawn = await compose(source, '⿵冂木')
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.parts[1].origin).toBe('glyph 木')
  })

  it('lays a grid out in the region it is given, without leaves of its own', async () => {
    await source.ready()
    await source.load(source.filesOf(['㐅', '乂']))
    const composer = new Composer(source.store())
    const region = [100, 100, 700, 900]
    const parts = composer.cellLayout(composer.parse('⿱⿰㐅㐅⿰㐅乂'), region, { leafIndices: false })
    expect(parts).toHaveLength(4)
    expect(parts.every(part => part.leaf === undefined)).toBe(true)
    for (const part of parts) {
      expect(part.target[0]).toBeGreaterThanOrEqual(region[0])
      expect(part.target[1]).toBeGreaterThanOrEqual(region[1])
      expect(part.target[2]).toBeLessThanOrEqual(region[2])
      expect(part.target[3]).toBeLessThanOrEqual(region[3])
    }
    expect(parts[0].target[3]).toBeCloseTo(parts[1].target[3], 6)
    expect(parts[2].target[3]).toBeCloseTo(parts[3].target[3], 6)
  })
})

describe('a component cut from a host', () => {
  it('fills the cell it is given, up to the export cell stretch', async () => {
    await source.ready()
    await source.load(source.filesOf(['穴', '又', '𠆢']))
    const composer = new Composer(source.store())
    // 𠆢's cut from 㓿 is a wide, shallow piece; its cell is a short share of a three-row stack.
    const piece = makePart([{ ops: commands('MLLL'), light: Float64Array.from([300, 0, 879, 0, 879, 225, 300, 225]),
      heavy: Float64Array.from([300, 0, 879, 0, 879, 225, 300, 225]), width: null }], [300, 0, 879, 225])
    composer.host = (op, i, child) => child === '𠆢' ? { record: { h: '㓿', g: 0 }, piece } : null
    const parts = composer.shares('⿳', ['穴', '𠆢', '又'], composer.face)
    const inner = parts.find(part => part.origin === 'host 㓿')
    expect(inner).toBeDefined()
    const width = inner.target[2] - inner.target[0]
    // The cell spans the face; the part takes most of it rather than a sliver of its own width.
    expect(width).toBeGreaterThan((composer.face[2] - composer.face[0]) * 0.7)
    // It may stretch past a placed part's share, and never past a cell's own allowance.
    expect(stretchOf(inner.source, inner.target)).toBeLessThanOrEqual(composer.C.CELL_STRETCH + 1e-9)
  })
})
