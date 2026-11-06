import { describe, expect, it } from 'bun:test'
import { LONGEST, PYRAMID_LONGEST, isDescription, parse, pyramidCount, pyramidOnBase, pyramidRows, pyramidSequence, write } from '../src/core/index.js'
import { PYRAMID_LAYERS, tooLarge } from '@han-compose/composer/loader'

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

  it('reads a long pyramid on a base past the ordinary length', () => {
    const text = '⿱' + pyramidSequence('口', 12) + '木'
    expect([...text].length).toBeGreaterThan(LONGEST)
    expect(isDescription(text)).toBe(true)
    expect(pyramidOnBase(tree(text))).toEqual({ cell: '口', layers: 12, base: '木' })
    expect(tooLarge(tree(text))).toBe(false)
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
    expect(tooLarge(tree('⿱' + pyramidSequence('口', PYRAMID_LAYERS) + '木'))).toBe(false)
    expect(tooLarge(tree('⿱' + pyramidSequence('口', PYRAMID_LAYERS + 1) + '木'))).toBe(true)
  })
})

describe('a pyramid on a base', () => {
  it('reads rows of 1, 2, … cells and one part under them, however the stack is grouped', () => {
    for (const text of ['⿳口⿰口口木', '⿱⿱口⿰口口木', '⿱口⿱⿰口口木'])
      expect(pyramidOnBase(tree(text))).toEqual({ cell: '口', layers: 2, base: '木' })
    expect(pyramidOnBase({ op: '⿳', parts: ['口', { op: '⿰', parts: ['口', '口'] }, '木'] }))
      .toEqual({ cell: '口', layers: 2, base: '木' })
    // A base may repeat the cell, and a description may be the cell.
    expect(pyramidOnBase(tree('⿳口⿰口口口'))).toEqual({ cell: '口', layers: 2, base: '口' })
    expect(pyramidOnBase(tree('⿱' + pyramidSequence('⿰木口', 2) + '水')))
      .toEqual({ cell: { op: '⿰', parts: ['木', '口'] }, layers: 2, base: '水' })
  })

  it('reads a deeper pyramid on a base', () => {
    expect(pyramidOnBase(tree('⿱' + pyramidSequence('口', 3) + '木'))).toEqual({ cell: '口', layers: 3, base: '木' })
  })

  it('reads a stacked cell or base whole', () => {
    expect(pyramidOnBase(tree('⿱' + pyramidSequence('⿱木口', 2) + '水')))
      .toEqual({ cell: { op: '⿱', parts: ['木', '口'] }, layers: 2, base: '水' })
    expect(pyramidOnBase(tree('⿳口⿰口口⿱水火')))
      .toEqual({ cell: '口', layers: 2, base: { op: '⿱', parts: ['水', '火'] } })
  })

  it('leaves whole pyramids, rows, sideways pyramids and plain stacks alone', () => {
    for (const text of ['⿳口⿰口口⿲口口口', '⿱口⿰口口', '⿱木口', '⿳口⿰木木口', '⿳口⿰口口⿰木木', '⿰口口', '⿱木⿰木木',
      '⿱⿱⿰口口口木', '⿱⿰口⿱口口木', '⿱⿰⿱口口口木'])
      expect(pyramidOnBase(tree(text))).toBeNull()
    expect(pyramidOnBase(tree('⿳口⿰口口木'), { minLayers: 3 })).toBeNull()
    expect(pyramidOnBase(tree('⿳口⿰口口木'), { minLayers: 1 })).toBeNull()
  })

  it('keeps the base and the cell within the preview limits', () => {
    const deep = '⿴'.repeat(9) + '口'.repeat(10)
    expect(tooLarge(tree('⿳口⿰口口' + deep))).toBe(true)
    expect(tooLarge(tree('⿳口⿰口口木'))).toBe(false)
  })
})
