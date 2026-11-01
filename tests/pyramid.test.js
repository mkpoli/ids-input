import { describe, expect, it } from 'bun:test'
import { LONGEST, PYRAMID_LONGEST, isDescription, parse, pyramidCount, pyramidRows, pyramidSequence, write } from '../src/core/index.js'
import { PYRAMID_LAYERS, compose, createSource, sketch, tooLarge } from '../src/composer/loader.js'
import { Composer } from '../src/composer/compose.js'
import { pyramidCells } from '../src/composer/pyramid.js'
import { groupParts } from '../src/core/preview.js'
import { files } from './fixtures/composer-export.js'

const sourceOf = (fetched = []) => createSource(async name => {
  fetched.push(name)
  const body = files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})
const tree = text => parse(text).tree

describe('a pyramid sequence', () => {
  it('writes rows of 1, 2, 3 and on', () => {
    expect(pyramidSequence('口', 1)).toBe('口')
    expect(pyramidSequence('口', 2)).toBe('⿱口⿰口口')
    expect(pyramidSequence('口', 3)).toBe('⿳口⿰口口⿲口口口')
    expect(pyramidSequence('口', 4)).toBe('⿱⿱口⿰口口⿱⿲口口口⿰⿰口口⿰口口')
    expect(pyramidSequence('口', 5)).toBe('⿱⿳口⿰口口⿲口口口⿱⿰⿰口口⿰口口⿰⿰口口⿲口口口')
    expect(pyramidCount(4)).toBe(10)
    expect(pyramidCount(64)).toBe(2080)
  })

  it('writes a bottom pyramid from the widest row down to one', () => {
    expect(pyramidSequence('口', 3, { direction: 'top' })).toBe(pyramidSequence('口', 3))
    expect(pyramidSequence('口', 1, { direction: 'bottom' })).toBe('口')
    expect(pyramidSequence('口', 2, { direction: 'bottom' })).toBe('⿱⿰口口口')
    expect(pyramidSequence('口', 3, { direction: 'bottom' })).toBe('⿳⿲口口口⿰口口口')
    expect(pyramidSequence('口', 4, { direction: 'bottom' })).toBe('⿱⿱⿰⿰口口⿰口口⿲口口口⿱⿰口口口')
    expect(pyramidRows('口', { minLayers: 1 })).toEqual({ cell: '口', layers: 1, count: 1, direction: 'top' })
    expect(pyramidRows(tree('⿱⿰口口口'), { minLayers: 2 })).toEqual({ cell: '口', layers: 2, count: 3, direction: 'bottom' })
  })

  it('turns a pyramid sideways', () => {
    expect(pyramidSequence('口', 2, { direction: 'left' })).toBe('⿰口⿱口口')
    expect(pyramidSequence('口', 2, { direction: 'right' })).toBe('⿰⿱口口口')
    expect(pyramidSequence('口', 3, { direction: 'left' })).toBe('⿲口⿱口口⿳口口口')
    expect(pyramidSequence('口', 3, { direction: 'right' })).toBe('⿲⿳口口口⿱口口口')
    expect(pyramidSequence('口', 4, { direction: 'left' })).toBe('⿰⿰口⿱口口⿰⿳口口口⿱⿱口口⿱口口')
    expect(pyramidRows(tree('⿰口⿱口口'), { minLayers: 2 })).toEqual({ cell: '口', layers: 2, count: 3, direction: 'left' })
    expect(pyramidRows(tree('⿰⿱口口口'), { minLayers: 2 })).toEqual({ cell: '口', layers: 2, count: 3, direction: 'right' })
    expect(pyramidRows(tree('⿲口⿱口口⿳口口口'), { minLayers: 2 })).toEqual({ cell: '口', layers: 3, count: 6, direction: 'left' })
    expect(pyramidRows(tree('⿲⿳口口口⿱口口口'), { minLayers: 2 })).toEqual({ cell: '口', layers: 3, count: 6, direction: 'right' })
    // A sideways pyramid repeats a description just as a row does.
    const cell = '⿰木口'
    expect(pyramidSequence(cell, 2, { direction: 'left' })).toBe('⿰⿰木口⿱⿰木口⿰木口')
    expect(pyramidRows(tree(pyramidSequence(cell, 3, { direction: 'right' })))?.direction).toBe('right')
  })

  it('reads a bottom pyramid with equivalent groupings and editor trees', () => {
    expect(pyramidRows(tree('⿱⿰⿰口口⿰口口⿳⿲口口口⿰口口口')))
      .toEqual({ cell: '口', layers: 4, count: 10, direction: 'bottom' })
    expect(pyramidRows({ op: '⿳', parts: [{ op: '⿲', parts: ['口', '口', '口'] }, { op: '⿰', parts: ['口', '口'] }, '口'] }))
      .toEqual({ cell: '口', layers: 3, count: 6, direction: 'bottom' })
    for (const text of ['⿳⿲口口口口⿰口口', '⿳⿲口口口⿰口口木', '⿳⿲口口口⿰口口⿰口口'])
      expect(pyramidRows(tree(text))).toBeNull()
  })

  it('keeps letter components literal', () => {
    const text = pyramidSequence('L', 3)
    expect(pyramidRows(parse(text).tree)).toEqual({ cell: 'L', layers: 3, count: 6, direction: 'top' })
    expect([...text].filter(char => char === 'L')).toHaveLength(6)
  })

  it('keeps emoji and Hangul components whole', () => {
    for (const part of ['👍🏽', '가']) {
      const text = pyramidSequence(part, 3)
      expect(pyramidRows(parse(text).tree)?.cell).toBe(part)
    }
    expect(() => pyramidSequence('木ˊ', 3)).toThrow(TypeError)
  })

  it('refuses a text that is no one part, or a part that cannot repeat as written', () => {
    expect(() => pyramidSequence('木口', 3)).toThrow(TypeError)
    expect(() => pyramidSequence('木ˊ', 3)).toThrow(TypeError)
    expect(() => pyramidSequence('口', 0)).toThrow(RangeError)
    expect(() => pyramidSequence('口', 2.5)).toThrow(RangeError)
    expect(() => pyramidSequence('口', 3, { direction: /** @type {any} */ ('up') })).toThrow(RangeError)
  })

  it('repeats a description instead of one component', () => {
    const cell = '⿱众⿰众众'
    expect(pyramidSequence(cell, 2)).toBe('⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众')
    const found = pyramidRows(tree(pyramidSequence(cell, 3)))
    expect(found).toMatchObject({ layers: 3, count: 6, direction: 'top' })
    expect(write(found.cell)).toBe(cell)
    // Two rows read back only when asked for, so a two-row pyramid stays a description by default.
    expect(pyramidRows(tree(pyramidSequence(cell, 2)))).toBeNull()
    expect(pyramidRows(tree(pyramidSequence(cell, 2)), { minLayers: 2 })?.cell).toEqual(parse(cell).tree)
  })

  it('repeats a part of several leaves without splitting it into its leaves', () => {
    const cell = '⿰木口', text = pyramidSequence(cell, 3)
    expect(text).toBe('⿳⿰木口⿰⿰木口⿰木口⿲⿰木口⿰木口⿰木口')
    expect(pyramidRows(tree(text))).toEqual({ cell: parse(cell).tree, layers: 3, count: 6, direction: 'top' })
    expect(pyramidSequence(cell, 2, { direction: 'bottom' })).toBe('⿱⿰⿰木口⿰木口⿰木口')
  })

  it('lays out empty slots for a part that is empty or ⬚', () => {
    expect(pyramidSequence('', 3)).toBe('⿳⬚⿰⬚⬚⿲⬚⬚⬚')
    expect(pyramidSequence('⬚', 2)).toBe('⿱⬚⿰⬚⬚')
    expect(pyramidSequence('  ', 2)).toBe('⿱⬚⿰⬚⬚')
    expect(pyramidSequence('', 2, { direction: 'bottom' })).toBe('⿱⿰⬚⬚⬚')
    expect(parse(pyramidSequence('', 4), { open: true }).tree).toEqual(parse('⿱⿱⬚⿰⬚⬚⿱⿲⬚⬚⬚⿰⿰⬚⬚⿰⬚⬚', { open: true }).tree)
  })

  it('reads a pyramid of a long part past the ordinary length', () => {
    const short = '⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众'
    const three = pyramidSequence(short, 3)
    expect([...three].length).toBeGreaterThan(LONGEST)
    expect(isDescription(three)).toBe(true)
    expect(pyramidRows(tree(three))?.layers).toBe(3)
    expect(tooLarge(tree(three))).toBe(false)
    // Two rows count too, so a long cell can be repeated once above a row of two.
    const long = '⿰⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众⿱众⿰众众'
    const two = pyramidSequence(long, 2)
    expect([...two].length).toBeGreaterThan(LONGEST)
    expect(isDescription(two)).toBe(true)
    expect(pyramidRows(tree(two), { minLayers: 2 })?.layers).toBe(2)
    expect(tooLarge(tree(two))).toBe(false)
  })

  it('reads its own sequences back at every depth and direction', () => {
    for (const direction of ['top', 'bottom', 'left', 'right']) for (let layers = 3; layers <= 12; layers++) {
      const text = pyramidSequence('口', layers, { direction })
      const found = pyramidRows(tree(text))
      expect(found).toEqual({ cell: '口', layers, count: pyramidCount(layers), direction })
      expect([...text].length).toBeLessThanOrEqual(PYRAMID_LONGEST)
    }
  })

  it('reads equivalent row and stack groupings', () => {
    for (const text of [
      '⿳口⿰口口⿲口口口',
      '⿱⿳口⿰口口⿲口口口⿰⿰口口⿰口口',
      '⿱⿱口⿰口口⿱⿲口口口⿰⿰口口⿰口口',
      '⿱⿳口⿰口口⿲口口口⿰⿰口口⿰口口',
    ]) expect(pyramidRows(tree(text))?.layers).toBe([...text].filter(ch => ch === '口').length === 6 ? 3 : 4)
    expect(pyramidRows(tree('⿱⿳口⿰口口⿲口口口⿰⿰口口⿰口口'))).toEqual({ cell: '口', layers: 4, count: 10, direction: 'top' })
  })

  it('reads an editor tree as well as a parsed one', () => {
    expect(pyramidRows({ op: '⿳', parts: ['口', { op: '⿰', parts: ['口', '口'] }, { op: '⿲', parts: ['口', '口', '口'] }] }))
      .toEqual({ cell: '口', layers: 3, count: 6, direction: 'top' })
  })

  it('leaves single rows, pairs and other grids alone', () => {
    for (const text of ['口', '⿰口口', '⿱口⿰口口', '⿱口口', '⿰⿱口口⿱口口', '⿳口⿰口口⿲口口木', '⿳口⿰口口⿲口口'])
      expect(pyramidRows(tree(text))).toBeNull()
    expect(pyramidRows(tree('⿳口⿰口口⿲口口口'), { minLayers: 4 })).toBeNull()
  })

  it('reads a long pyramid as a draft after a cell changes', () => {
    const text = pyramidSequence('口', 12), changed = text.replace('口', '木')
    expect([...text].length).toBeGreaterThan(64)
    expect(parse(changed, { open: true }).tree).not.toBeUndefined()
    expect(parse(changed).problem).toBe('character')
    expect(parse(changed, { open: true }).tree).not.toEqual(parse(text, { open: true }).tree)
  })

  it('keeps a pyramid within the preview limits in every direction', () => {
    for (const direction of ['top', 'bottom', 'left', 'right']) {
      expect(tooLarge(tree(pyramidSequence('口', 6, { direction })))).toBe(false)
      expect(tooLarge(tree(pyramidSequence('口', 7, { direction })))).toBe(false)
      expect(tooLarge(tree(pyramidSequence('口', PYRAMID_LAYERS, { direction })))).toBe(false)
      expect(tooLarge(tree(pyramidSequence('口', PYRAMID_LAYERS + 1, { direction })))).toBe(true)
      expect(parse(pyramidSequence('口', PYRAMID_LAYERS, { direction })).problem).toBeUndefined()
    }
  })
})

describe('pyramid cells', () => {
  it('makes every cell the same square in centred rows', () => {
    for (const layers of [3, 4, 5, 12]) {
      const cells = pyramidCells([0, 0, 1000, 1000], layers)
      expect(cells).toHaveLength(pyramidCount(layers))
      const width = cells[0][2] - cells[0][0], height = cells[0][3] - cells[0][1]
      expect(width).toBeCloseTo(height, 8)
      for (const cell of cells) {
        expect(cell[2] - cell[0]).toBeCloseTo(width, 8)
        expect(cell[3] - cell[1]).toBeCloseTo(height, 8)
      }
      const centers = cells.map(cell => (cell[0] + cell[2]) / 2)
      expect(centers[0]).toBeCloseTo(500, 8)
      expect(cells[0][1]).toBeGreaterThan(cells[1][1])
      expect(cells[0][0]).toBeGreaterThan(cells[1][0])
      expect(cells.at(-1)[1]).toBeCloseTo(0, 8)
      expect(cells[0][3]).toBeCloseTo(1000, 8)
    }
  })

  it('centres a bottom pyramid without changing cell size or reading order', () => {
    for (const layers of [1, 3, 4, 12]) {
      const region = [100, -200, 1300, 800]
      const normal = pyramidCells(region, layers)
      const reversed = pyramidCells(region, layers, { direction: 'bottom' })
      expect(pyramidCells(region, layers, { direction: 'top' })).toEqual(normal)
      expect(reversed).toHaveLength(pyramidCount(layers))
      let offset = 0
      for (let count = layers; count >= 1; count--) {
        const row = reversed.slice(offset, offset + count)
        expect((row[0][0] + row.at(-1)[2]) / 2).toBeCloseTo(700, 8)
        for (let i = 0; i < row.length; i++) {
          const cell = row[i]
          expect(cell[2] - cell[0]).toBeCloseTo(normal[0][2] - normal[0][0], 8)
          expect(cell[3] - cell[1]).toBeCloseTo(cell[2] - cell[0], 8)
          expect(cell[1]).toBeCloseTo(row[0][1], 8)
          if (i) expect(cell[0]).toBeGreaterThan(row[i - 1][2])
        }
        if (offset) expect(row[0][3]).toBeLessThan(reversed[offset - 1][1])
        offset += count
      }
      expect(reversed[0][3]).toBeCloseTo(800, 8)
      expect(reversed.at(-1)[1]).toBeCloseTo(-200, 8)
    }
  })

  it('draws a sideways pyramid in columns, with the cell size of the other directions', () => {
    const region = [100, -200, 1300, 800], top = pyramidCells(region, 4)
    for (const direction of ['left', 'right']) {
      const cells = pyramidCells(region, 4, { direction })
      expect(cells).toHaveLength(10)
      expect(cells[0][2] - cells[0][0]).toBeCloseTo(top[0][2] - top[0][0], 8)
      let offset = 0
      for (let index = 0; index < 4; index++) {
        const count = direction === 'left' ? index + 1 : 4 - index
        const column = cells.slice(offset, offset + count)
        const x = (column[0][0] + column[0][2]) / 2
        for (const cell of column) expect((cell[0] + cell[2]) / 2).toBeCloseTo(x, 8)
        for (let i = 1; i < column.length; i++) expect(column[i][1]).toBeLessThan(column[i - 1][1])
        expect((column[0][3] + column.at(-1)[1]) / 2).toBeCloseTo(300, 8)
        if (count === 4) {
          expect(column[0][3]).toBeCloseTo(800, 8)
          expect(column.at(-1)[1]).toBeCloseTo(-200, 8)
        }
        if (offset) expect(x).toBeGreaterThan((cells[offset - 1][0] + cells[offset - 1][2]) / 2)
        offset += count
      }
    }
  })

  it('keeps the six-cell spacing of the original mouth pyramid', () => {
    const cells = pyramidCells([0, 0, 900, 900], 3)
    expect(cells[0][2] - cells[0][0]).toBeCloseTo(900 / 3.26, 8)
    expect(cells[0][0] - cells[1][0]).toBeCloseTo(900 / 3.26 * 1.13 / 2, 8)
    expect(cells[2][0] - cells[1][0]).toBeCloseTo(900 / 3.26 * 1.13, 8)
  })
})

describe('drawing a pyramid', () => {
  it('draws every cell at the same size with one glyph per cell', async () => {
    for (const layers of [3, 4, 5]) {
      const text = pyramidSequence('口', layers), source = sourceOf()
      const leaves = await sketch(source, text)
      expect(leaves).toHaveLength(pyramidCount(layers))
      expect(leaves.every(leaf => !leaf.empty)).toBe(true)
      const drawn = await compose(source, text)
      expect(drawn.parts).toHaveLength(pyramidCount(layers))
      expect(drawn.parts.every(part => part.origin === 'glyph 口')).toBe(true)
      const boxes = drawn.parts.map(part => part.box)
      for (const box of boxes) {
        expect(box[2]).toBeCloseTo(boxes[0][2], 6)
        expect(box[3]).toBeCloseTo(boxes[0][3], 6)
      }
    }
  })

  it('draws a bottom pyramid with upright glyphs and matching leaf ownership', async () => {
    const source = sourceOf()
    const normal = await compose(source, pyramidSequence('木', 4))
    const text = pyramidSequence('木', 4, { direction: 'bottom' })
    const drawn = await compose(source, text, { separate: true })
    const leaves = await sketch(source, text)
    expect(drawn.parts).toHaveLength(10)
    expect(leaves).toHaveLength(10)
    const localOutline = part => part.d.match(/-?\d+(?:\.\d+)?/g).map((n, i) => Number(n) - part.box[i % 2])
    const upright = localOutline(normal.parts[0])
    for (const part of drawn.parts) {
      expect(part.origin).toBe('glyph 木')
      expect(part.box[2]).toBeCloseTo(normal.parts[0].box[2], 6)
      expect(part.box[3]).toBeCloseTo(normal.parts[0].box[3], 6)
      const outline = localOutline(part)
      expect(outline).toHaveLength(upright.length)
      outline.forEach((n, i) => expect(n).toBeCloseTo(upright[i], 0))
    }
    for (let i = 1; i < 4; i++) {
      expect(leaves[i].box[1]).toBeCloseTo(leaves[0].box[1], 8)
      expect(drawn.parts[i].box[1]).toBeCloseTo(drawn.parts[0].box[1], 6)
    }
    expect(leaves[4].box[1]).toBeGreaterThan(leaves[0].box[1] + leaves[0].box[3])
    expect(drawn.parts[4].box[1]).toBeGreaterThan(drawn.parts[0].box[1])
    expect(drawn.parts.map(part => part.leaf)).toEqual([...Array(10).keys()])
    expect(groupParts(drawn.parts, leaves)?.map(group => group.parts)).toEqual([...Array(10).keys()].map(i => [i]))
  })

  it('draws a sideways pyramid with upright glyphs and one leaf per cell', async () => {
    const source = sourceOf(), text = pyramidSequence('木', 4, { direction: 'left' })
    const drawn = await compose(source, text, { separate: true })
    const leaves = await sketch(source, text)
    const top = await compose(source, pyramidSequence('木', 4))
    expect(drawn.parts).toHaveLength(10)
    expect(leaves).toHaveLength(10)
    const localOutline = part => part.d.match(/-?\d+(?:\.\d+)?/g).map((n, i) => Number(n) - part.box[i % 2])
    const upright = localOutline(top.parts[0])
    for (const part of drawn.parts) {
      expect(part.origin).toBe('glyph 木')
      expect(part.box[2]).toBeCloseTo(top.parts[0].box[2], 6)
      expect(part.box[3]).toBeCloseTo(top.parts[0].box[3], 6)
      const outline = localOutline(part)
      expect(outline).toHaveLength(upright.length)
      outline.forEach((n, i) => expect(n).toBeCloseTo(upright[i], 0))
    }
    expect(drawn.parts.map(part => part.leaf)).toEqual([...Array(10).keys()])
    // The apex cell is centred on the widest column, and the columns run left to right.
    const apex = drawn.parts[0], high = drawn.parts[6], low = drawn.parts[9]
    expect(apex.box[1] + apex.box[3] / 2).toBeCloseTo((high.box[1] + low.box[1] + low.box[3]) / 2, 5)
    expect(apex.box[0] + apex.box[2]).toBeLessThan(high.box[0])
  })

  it('draws the spellings of a 4-row pyramid alike', async () => {
    const source = sourceOf(), rows = await compose(source, '⿱⿱口⿰口口⿱⿲口口口⿰⿰口口⿰口口')
    const columns = await compose(source, '⿱⿳口⿰口口⿲口口口⿰⿰口口⿰口口')
    expect(columns).toEqual(rows)
    expect(columns.parts).toHaveLength(10)
  })

  it('gives every leaf its own piece in a separated drawing', async () => {
    const text = pyramidSequence('口', 4), source = sourceOf()
    const drawn = await compose(source, text, { separate: true })
    expect(drawn.parts).toHaveLength(10)
    expect(drawn.parts.map(part => part.leaf)).toEqual([...Array(10).keys()])
    const groups = groupParts(drawn.parts, await sketch(source, text))
    expect(groups?.map(group => group.parts)).toEqual([...Array(10).keys()].map(i => [i]))
  })

  it('loads each repeated part asset once instead of once per node', async () => {
    const fetched = [], text = pyramidSequence('口', 12)
    await compose(sourceOf(fetched), text)
    // The part's own record is read, and the whole-sequence key adds a second file; the source
    // caches by name, so a fetch per node would show up near the 78 leaves.
    const glyphs = fetched.filter(name => name.startsWith('g/'))
    expect(glyphs).toContain('g/037.json')
    expect(glyphs.length).toBeLessThanOrEqual(2)
    expect(new Set(glyphs).size).toBe(glyphs.length)
    expect(fetched.some(name => name.startsWith('p/'))).toBe(false)
  })

  it('draws a pyramid of empty slots in its cells, numbered in reading order', async () => {
    const source = sourceOf()
    for (const layers of [3, 6]) {
      const text = pyramidSequence('', layers)
      const drawn = await compose(source, text)
      expect(drawn.parts).toHaveLength(0)
      expect(drawn.slots).toHaveLength(pyramidCount(layers))
      expect(drawn.slots.map(slot => slot.index)).toEqual([...Array(pyramidCount(layers)).keys()])
      const [first] = drawn.slots
      for (const slot of drawn.slots) {
        expect(slot.box[2]).toBeCloseTo(first.box[2], 6)
        expect(slot.box[3]).toBeCloseTo(first.box[3], 6)
      }
      expect(await sketch(source, text)).toHaveLength(pyramidCount(layers))
    }
    // A cell of several slots renumbers its slots each time it repeats.
    const mixed = await compose(source, pyramidSequence('⿰木⬚', 3))
    expect(mixed.parts).toHaveLength(6)
    expect(mixed.slots.map(slot => slot.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('lets a pyramid of empty slots through the preview limits', () => {
    const text = pyramidSequence('', 24), tree = parse(text, { open: true }).tree
    expect(tooLarge(tree)).toBe(false)
    expect(pyramidRows(tree)?.layers).toBe(24)
    expect(pyramidRows(tree)?.cell).toBeNull()
    expect(pyramidRows(parse(text, { open: true }).tree)?.count).toBe(300)
  })

  it('draws a pyramid of a description, one cell per repeat and its leaves in order', async () => {
    const source = sourceOf(), text = pyramidSequence('⿰木口', 3)
    const leaves = await sketch(source, text)
    expect(leaves).toHaveLength(pyramidCount(3) * 2)
    const drawn = await compose(source, text)
    expect(drawn.parts).toHaveLength(pyramidCount(3) * 2)
    expect(drawn.parts.map(part => part.origin)).toEqual(
      Array.from({ length: pyramidCount(3) }, () => ['glyph 木', 'glyph 口']).flat())
    const separated = await compose(source, text, { separate: true })
    expect(separated.parts.map(part => part.leaf)).toEqual([...Array(pyramidCount(3) * 2).keys()])
    expect(groupParts(separated.parts, leaves)?.map(group => group.parts)).toEqual(
      [...Array(pyramidCount(3) * 2).keys()].map(i => [i]))
    // Every cell's two leaves share the cell: the cell is a third of the drawing each way.
    const cells = new Map()
    separated.parts.forEach((part, i) => {
      const cell = Math.floor(i / 2)
      const [x, y, width, height] = part.box
      const box = cells.get(cell) ?? [x, y, x + width, y + height]
      cells.set(cell, [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + width), Math.max(box[3], y + height)])
    })
    for (const box of cells.values()) expect(box[2] - box[0]).toBeGreaterThan(80)
  })

  it('draws a two-row pyramid of a description in equal cells', async () => {
    const source = sourceOf(), text = pyramidSequence('⿰木口', 2)
    expect(pyramidRows(tree(text), { minLayers: 2 })?.layers).toBe(2)
    expect(pyramidRows(tree(text))).toBeNull()
    expect(await sketch(source, text)).toHaveLength(6)
    const drawn = await compose(source, text)
    expect(drawn.cells).toBeUndefined()
    // The fixture draws each cell as its two glyphs; group them into the three pyramid cells.
    expect(drawn.parts).toHaveLength(6)
    const boxes = drawn.parts.map(part => part.box)
    const union = group => group.reduce((box, [x, y, width, height]) =>
      [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + width), Math.max(box[3], y + height)],
    [Infinity, Infinity, -Infinity, -Infinity])
    const cells = [union(boxes.slice(0, 2)), union(boxes.slice(2, 4)), union(boxes.slice(4, 6))]
    for (const cell of cells) {
      expect(cell[2] - cell[0]).toBeCloseTo(cells[0][2] - cells[0][0], 5)
      expect(cell[3] - cell[1]).toBeCloseTo(cells[0][3] - cells[0][1], 5)
    }
    expect((cells[0][0] + cells[0][2]) / 2).toBeCloseTo((cells[1][0] + cells[2][2]) / 2, 5)
    expect(cells[0][3]).toBeLessThan(cells[1][1])
    expect(cells[2][0]).toBeGreaterThan(cells[1][2])
  })

  it('keeps a two-row pyramid of one part in the composer', async () => {
    const source = sourceOf()
    await source.ready()
    const composer = new Composer(source.store())
    expect(composer.pyramid(composer.parse('⿱口⿰口口'))).toBeNull()
    expect(composer.pyramid(composer.parse('⿱木⿰木木'))).toBeNull()
    expect(composer.pyramid(composer.parse(pyramidSequence('⿰木口', 2)))?.layers).toBe(2)
    expect(composer.pyramid(composer.parse(pyramidSequence('口', 3)))?.layers).toBe(3)
    expect(composer.pyramid(composer.parse(pyramidSequence('口', 3, { direction: 'left' })))?.direction).toBe('left')
    expect(composer.pyramid(composer.parse(pyramidSequence('口', 2, { direction: 'right' })))).toBeNull()
    expect(composer.pyramid(composer.parse(pyramidSequence('口', 2, { direction: 'bottom' })))).toBeNull()
    // An empty slot has no designed form; the cells lay it out.
    expect(composer.pyramid(composer.parse(pyramidSequence('', 2)))?.layers).toBe(2)
  })

  it('draws a two-layer slot scaffold in the pyramid\'s cells', async () => {
    const source = sourceOf()
    for (const direction of ['top', 'bottom', 'left', 'right']) {
      const drawn = await compose(source, pyramidSequence('', 2, { direction }))
      expect(drawn.parts).toHaveLength(0)
      expect(drawn.slots).toHaveLength(3)
      expect(drawn.slots.map(slot => slot.index)).toEqual([0, 1, 2])
      const boxes = drawn.slots.map(slot => slot.box)
      for (const box of boxes) {
        expect(box[2]).toBeCloseTo(boxes[0][2], 6)
        expect(box[3]).toBeCloseTo(boxes[0][3], 6)
      }
    }
  })

  it('draws a pyramid nested in another description', async () => {
    const source = sourceOf(), text = `⿱木${pyramidSequence('口', 4)}`
    const drawn = await compose(source, text, { separate: true })
    expect(drawn.parts).toHaveLength(11)
    // Dense as a whole, so the top description is laid out in cells and its parts say so.
    expect(drawn.parts.at(-1)?.origin).toBe('cells 口')
    const groups = groupParts(drawn.parts, await sketch(source, text))
    expect(groups).toHaveLength(11)
  })
})
