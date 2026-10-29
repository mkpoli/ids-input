import { describe, expect, it } from 'bun:test'
import { leaves, parse, place, repeatSequence, write } from '../src/core/index.js'

describe('a two-row repeat', () => {
  it('writes rows of two, three and four', () => {
    expect(repeatSequence('口', [2, 3])).toBe('⿱⿰口口⿲口口口')
    expect(repeatSequence('口', [3, 3])).toBe('⿱⿲口口口⿲口口口')
    expect(repeatSequence('口', [2, 4])).toBe('⿱⿰口口⿰⿰口口⿰口口')
    expect(repeatSequence('口', [4, 4])).toBe('⿱⿰⿰口口⿰口口⿰⿰口口⿰口口')
  })

  it('repeats a second component in the bottom row', () => {
    expect(repeatSequence('屮', [3, 3], { bottom: '刀' })).toBe('⿱⿲屮屮屮⿲刀刀刀')
    expect(repeatSequence('口', [2, 3], { bottom: '口' })).toBe(repeatSequence('口', [2, 3]))
  })

  it('reads back as one leaf per copy', () => {
    for (const rows of [[2, 3], [3, 3], [2, 4], [4, 4]]) {
      const tree = parse(repeatSequence('口', rows)).tree
      expect(leaves(tree).map(leaf => leaf.char)).toEqual(Array.from({ length: rows[0] + rows[1] }, () => '口'))
    }
    const mixed = parse(repeatSequence('屮', [3, 3], { bottom: '刀' })).tree
    expect(leaves(mixed).map(leaf => leaf.char)).toEqual(['屮', '屮', '屮', '刀', '刀', '刀'])
  })

  it('takes the place of a selected slot', () => {
    const tree = parse('⿰木⬚', { open: true }).tree
    const next = place(tree, [1], parse(repeatSequence('口', [2, 3])).tree).tree
    expect(write(next)).toBe('⿰木⿱⿰口口⿲口口口')
  })

  it('keeps letter, emoji and Hangul parts whole', () => {
    for (const part of ['L', '👍🏽', '가']) {
      const text = repeatSequence(part, [2, 3])
      expect(leaves(parse(text).tree).every(leaf => leaf.char === part)).toBe(true)
    }
  })

  it('refuses something that is not one component or two rows of two to four', () => {
    expect(() => repeatSequence('', [2, 3])).toThrow(TypeError)
    expect(() => repeatSequence('⿰木口', [2, 3])).toThrow(TypeError)
    expect(() => repeatSequence('木口', [2, 3])).toThrow(TypeError)
    expect(() => repeatSequence('口', [1, 3])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2, 5])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2.5, 3])).toThrow(RangeError)
    expect(() => repeatSequence('口', [2, 3], { bottom: '⿰木口' })).toThrow(TypeError)
    // Two regional indicators join into one flag, so the copies are not separate components.
    expect(() => repeatSequence('🇯', [2, 3])).toThrow(TypeError)
    expect(() => repeatSequence('口', [2, 3], { bottom: '🇯' })).toThrow(TypeError)
  })
})
