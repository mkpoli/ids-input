import { describe, expect, it } from 'bun:test'
import { PYRAMID_LONGEST, parse, pyramidCount, pyramidRows, pyramidSequence } from '../src/core/index.js'
import { PYRAMID_LAYERS, compose, createSource, sketch, tooLarge } from '../src/composer/loader.js'
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

  it('refuses something that is not one component or one layer', () => {
    expect(() => pyramidSequence('', 3)).toThrow(TypeError)
    expect(() => pyramidSequence('⿰木口', 3)).toThrow(TypeError)
    expect(() => pyramidSequence('木口', 3)).toThrow(TypeError)
    expect(() => pyramidSequence('口', 0)).toThrow(RangeError)
    expect(() => pyramidSequence('口', 2.5)).toThrow(RangeError)
  })

  it('reads its own sequences back at every depth', () => {
    for (let layers = 3; layers <= 12; layers++) {
      const text = pyramidSequence('口', layers)
      const found = pyramidRows(tree(text))
      expect(found).toEqual({ part: '口', layers, count: pyramidCount(layers) })
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
    expect(pyramidRows(tree('⿱⿳口⿰口口⿲口口口⿰⿰口口⿰口口'))).toEqual({ part: '口', layers: 4, count: 10 })
  })

  it('reads an editor tree as well as a parsed one', () => {
    expect(pyramidRows({ op: '⿳', parts: ['口', { op: '⿰', parts: ['口', '口'] }, { op: '⿲', parts: ['口', '口', '口'] }] }))
      .toEqual({ part: '口', layers: 3, count: 6 })
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

  it('keeps a pyramid within the preview limits at depths the old limits refused', () => {
    expect(tooLarge(tree(pyramidSequence('口', 6)))).toBe(false)
    expect(tooLarge(tree(pyramidSequence('口', 7)))).toBe(false)
    expect(tooLarge(tree(pyramidSequence('口', PYRAMID_LAYERS)))).toBe(false)
    expect(tooLarge(tree(pyramidSequence('口', PYRAMID_LAYERS + 1)))).toBe(true)
    expect(() => parse(pyramidSequence('口', PYRAMID_LAYERS))).not.toThrow()
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

  it('loads the repeated part once instead of every node', async () => {
    const fetched = [], text = pyramidSequence('口', 12)
    await compose(sourceOf(fetched), text)
    expect(fetched.filter(name => name.startsWith('g/'))).toHaveLength(1)
    expect(fetched.some(name => name.startsWith('p/'))).toBe(false)
  })

  it('draws a pyramid nested in another description', async () => {
    const source = sourceOf(), text = `⿱木${pyramidSequence('口', 4)}`
    const drawn = await compose(source, text, { separate: true })
    expect(drawn.parts).toHaveLength(11)
    expect(drawn.parts.at(-1)?.origin).toBe('glyph 口')
    const groups = groupParts(drawn.parts, await sketch(source, text))
    expect(groups).toHaveLength(11)
  })
})
