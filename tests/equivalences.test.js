import { describe, expect, it } from 'bun:test'
import { importPairs, parsePair, parseSide } from '../demo/lib/equivalences.js'

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
    expect(parseSide('&U-i001+4E23;')).toBe('chise:U-i001+4E23')
    expect(parseSide('U-i001+4E23')).toBe('chise:U-i001+4E23')
  })

  it('reads a character as itself or as a code point', () => {
    expect(parseSide('叀')).toBe('ucs:53C0')
    expect(parseSide('ucs:53c0')).toBe('ucs:53C0')
    expect(parseSide('ucs:41')).toBe('ucs:41')
  })

  it('refuses text that names no component', () => {
    expect(parseSide('')).toBeNull()
    expect(parseSide('bsp:')).toBeNull()
    expect(parseSide('ucs:1234567')).toBeNull()
    expect(parseSide('ucs:D800')).toBeNull()
    expect(parseSide('ucs:110000')).toBeNull()
    expect(parseSide('&CDP 8BD0;')).toBeNull()
    expect(parseSide('custom:my-part')).toBe('custom:my-part')
    expect(parseSide('two')).toBeNull()
  })

  it('imports an exported file, including a short code point', () => {
    const exported = { format: 'ids-input/equivalences-mine', version: 1, rows: [
      { a: 'bsp:7', b: 'chise:CDP-8BD0', note: 'checked' },
      { a: 'ucs:41', b: 'bsp:5', note: 'A' },
    ] }
    expect(importPairs(exported)).toEqual([
      { a: 'bsp:7', b: 'chise:CDP-8BD0', note: 'checked' },
      { a: 'bsp:5', b: 'ucs:41', note: 'A' },
    ])
    expect(importPairs({ rows: [{ a: 'bsp:7', b: 'bsp:7', note: '' }, { a: 'ucs:D800', b: 'bsp:5' }] })).toEqual([])
  })

  it('sorts a pair and refuses one side against itself', () => {
    expect(parsePair('{7}', '&CDP-8BD0;')).toEqual(['bsp:7', 'chise:CDP-8BD0'])
    expect(parsePair('{7}', '{7}')).toBeNull()
    expect(parsePair('{7}', '')).toBeNull()
  })
})
