import { describe, expect, it } from 'bun:test'
import { enclosedRepeatSequence, leaves, parse, parseRepeatRows, place, repeatSequence, write } from '../src/core/index.js'

describe('row counts', () => {
  it('reads two or three counts, half-width or full-width', () => {
    expect(parseRepeatRows('3 4')).toEqual([3, 4])
    expect(parseRepeatRows('2,3')).toEqual([2, 3])
    expect(parseRepeatRows('2＋3')).toEqual([2, 3])
    expect(parseRepeatRows('２ ３')).toEqual([2, 3])
    expect(parseRepeatRows('2、3')).toEqual([2, 3])
    expect(parseRepeatRows('2·3')).toEqual([2, 3])
    expect(parseRepeatRows('2 1 2')).toEqual([2, 1, 2])
  })
  it('rejects other numbers and shapes', () => {
    for (const text of ['', '2', '2 5', '0 3', '2 1 2 3', '0x2 3', '2.0 3', '1e0 4', 'a b']) expect(parseRepeatRows(text)).toBeNull()
  })
})

describe('repeated rows', () => {
  it('writes rows of one to four', () => {
    expect(repeatSequence('口', [2, 3])).toBe('⿱⿰口口⿲口口口')
    expect(repeatSequence('口', [1, 3])).toBe('⿱口⿲口口口')
    expect(repeatSequence('口', [3, 3])).toBe('⿱⿲口口口⿲口口口')
    expect(repeatSequence('口', [2, 4])).toBe('⿱⿰口口⿰⿰口口⿰口口')
    expect(repeatSequence('口', [4, 4])).toBe('⿱⿰⿰口口⿰口口⿰⿰口口⿰口口')
    expect(repeatSequence('口', [3, 4])).toBe('⿱⿲口口口⿰⿰口口⿰口口')
  })

  it('writes a middle row of one', () => {
    expect(repeatSequence('口', [2, 1, 2])).toBe('⿳⿰口口口⿰口口')
    expect(repeatSequence('屮', [2, 1, 2], { bottom: '刀' })).toBe('⿳⿰屮屮屮⿰刀刀')
  })

  it('repeats a second component in the bottom row', () => {
    expect(repeatSequence('屮', [3, 3], { bottom: '刀' })).toBe('⿱⿲屮屮屮⿲刀刀刀')
    expect(repeatSequence('口', [2, 3], { bottom: '口' })).toBe(repeatSequence('口', [2, 3]))
  })

  it('reads back as one leaf per copy', () => {
    for (const rows of [[2, 3], [1, 3], [3, 3], [2, 4], [4, 4], [2, 1, 2]]) {
      const tree = parse(repeatSequence('口', rows)).tree
      expect(leaves(tree).map(leaf => leaf.char)).toEqual(Array.from({ length: rows.reduce((a, b) => a + b) }, () => '口'))
    }
    const mixed = parse(repeatSequence('屮', [3, 3], { bottom: '刀' })).tree
    expect(leaves(mixed).map(leaf => leaf.char)).toEqual(['屮', '屮', '屮', '刀', '刀', '刀'])
    const five = parse(repeatSequence('屮', [2, 1, 2], { bottom: '刀' })).tree
    expect(leaves(five).map(leaf => leaf.char)).toEqual(['屮', '屮', '屮', '刀', '刀'])
  })

  it('takes the place of a selected slot', () => {
    const tree = parse('⿰木⬚', { open: true }).tree
    const next = place(tree, [1], parse(repeatSequence('口', [2, 3])).tree).tree
    expect(write(next)).toBe('⿰木⿱⿰口口⿲口口口')
  })

  it('keeps letter, emoji and Hangul parts whole', () => {
    for (const part of ['L', '👍🏽', '가']) {
      const text = repeatSequence(part, [2, 1, 2])
      expect(leaves(parse(text).tree).every(leaf => leaf.char === part)).toBe(true)
    }
  })

  it('repeats a description or an empty slot as well as one component', () => {
    expect(repeatSequence('⿰木口', [2, 3])).toBe('⿱⿰⿰木口⿰木口⿲⿰木口⿰木口⿰木口')
    expect(repeatSequence('', [2, 3])).toBe('⿱⿰⬚⬚⿲⬚⬚⬚')
    expect(repeatSequence('⬚', [2, 1, 2])).toBe('⿳⿰⬚⬚⬚⿰⬚⬚')
    expect(repeatSequence('口', [2, 3], { bottom: '⿰木口' })).toBe('⿱⿰口口⿲⿰木口⿰木口⿰木口')
    expect(leaves(parse(repeatSequence('⿰木口', [2, 3])).tree).map(leaf => leaf.char)).toEqual(
      ['木', '口', '木', '口', '木', '口', '木', '口', '木', '口'])
  })

  it('refuses a text that is no one part or rows out of range, and parts that join', () => {
    expect(() => repeatSequence('木口', [2, 3])).toThrow(TypeError)
    expect(() => repeatSequence('口', [2])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2, 1, 2, 1])).toThrow(RangeError)
    expect(() => repeatSequence('口', [0, 3])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2, 5])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2.5, 3])).toThrow(RangeError)
    // Two regional indicators join into one flag, so the copies are not separate components.
    expect(() => repeatSequence('🇯', [2, 3])).toThrow(TypeError)
    expect(() => repeatSequence('口', [2, 3], { bottom: '🇯' })).toThrow(TypeError)
  })
})

describe('four copies inside an enclosure', () => {
  it('writes a 2×2 grid inside the host', () => {
    expect(enclosedRepeatSequence('囗', '口')).toBe('⿴囗⿱⿰口口⿰口口')
    expect(enclosedRepeatSequence('門', '日')).toBe('⿴門⿱⿰日日⿰日日')
  })

  it('reads back as the host and four copies', () => {
    const tree = parse(enclosedRepeatSequence('囗', '口')).tree
    expect(leaves(tree).map(leaf => leaf.char)).toEqual(['囗', '口', '口', '口', '口'])
  })

  it('takes a description or an empty slot as the host and the copies', () => {
    expect(enclosedRepeatSequence('⿰木口', '口')).toBe('⿴⿰木口⿱⿰口口⿰口口')
    expect(enclosedRepeatSequence('囗', '⿰木口')).toBe('⿴囗⿱⿰⿰木口⿰木口⿰⿰木口⿰木口')
    expect(enclosedRepeatSequence('', '口')).toBe('⿴⬚⿱⿰口口⿰口口')
    expect(enclosedRepeatSequence('囗', '')).toBe('⿴囗⿱⿰⬚⬚⿰⬚⬚')
    expect(leaves(parse(enclosedRepeatSequence('囗', '⿰木口')).tree).map(leaf => leaf.char)).toEqual(
      ['囗', '木', '口', '木', '口', '木', '口', '木', '口'])
  })

  it('refuses a copy that joins into one component', () => {
    expect(() => enclosedRepeatSequence('囗', '🇯')).toThrow(TypeError)
    expect(() => enclosedRepeatSequence('木口', '口')).toThrow(TypeError)
  })
})
