import { describe, expect, it } from 'bun:test'
import { parsePair, parseSide } from '../demo/lib/equivalences.js'

describe('equivalence input', () => {
  it('reads a numbered component in the three ways it is written', () => {
    expect(parseSide('{7}')).toBe('bsp:7')
    expect(parseSide('7')).toBe('bsp:7')
    expect(parseSide('bsp:7')).toBe('bsp:7')
    expect(parseSide('bsp:07')).toBe('bsp:7')
  })

  it('reads an entity with or without its name marker and scheme', () => {
    expect(parseSide('&CDP-8BD0;')).toBe('chise:CDP-8BD0')
    expect(parseSide('CDP-8BD0')).toBe('chise:CDP-8BD0')
    expect(parseSide('chise:CDP-8BD0')).toBe('chise:CDP-8BD0')
  })

  it('reads a character as itself or as a code point', () => {
    expect(parseSide('叀')).toBe('ucs:53C0')
    expect(parseSide('ucs:53c0')).toBe('ucs:53C0')
  })

  it('refuses text that names no component', () => {
    expect(parseSide('')).toBeNull()
    expect(parseSide('bsp:')).toBeNull()
    expect(parseSide('ucs:123')).toBeNull()
    expect(parseSide('two')).toBeNull()
  })

  it('sorts a pair and refuses one side against itself', () => {
    expect(parsePair('{7}', '&CDP-8BD0;')).toEqual(['bsp:7', 'chise:CDP-8BD0'])
    expect(parsePair('{7}', '{7}')).toBeNull()
    expect(parsePair('{7}', '')).toBeNull()
  })
})
