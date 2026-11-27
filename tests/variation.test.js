import { expect, test } from 'bun:test'
import { codePoints, parseVariationSelector, selectorInfo, variationBase, variationOf, variationSelector, withVariation } from '../src/core/variation.js'

test('a component is varied by its character, with or without a selector', () => {
  expect(variationBase('者')).toBe('者')
  expect(variationBase('者\u{E0101}')).toBe('者')
  expect(variationBase('者\u{E0101}ˊ')).toBe('者')
  expect(variationBase('𠮷\u{E0100}')).toBe('𠮷')
})

test('a slot, a node, a jamo run and an Emoji sequence have no variation sequence', () => {
  expect(variationBase(null)).toBe(null)
  expect(variationBase({ op: '⿰', parts: ['亻', '可'] })).toBe(null)
  expect(variationBase('가')).toBe(null)
  expect(variationBase('👩‍💻')).toBe(null)
  expect(variationBase('❤\uFE0F')).toBe(null)
  expect(variationBase('☺\uFE0E')).toBe(null)
})

test('choosing a sequence keeps the marks after it', () => {
  expect(withVariation('者ˊ', '者\u{E0101}')).toBe('者\u{E0101}ˊ')
  expect(withVariation('者\u{E0101}ˊ', '者')).toBe('者ˊ')
  expect(variationOf('者\u{E0101}ˊ')).toBe('者\u{E0101}')
})

test('a sequence is named by its code points', () => {
  expect(codePoints('者\u{E0101}')).toBe('U+8005 U+E0101')
})

test('variationSelector identifies SVS and IVS selectors and ignores plain or presentation forms', () => {
  expect(variationSelector('者\u{E0101}')).toEqual({
    base: '者', selector: '\u{E0101}', sequence: '者\u{E0101}',
    number: 18, tag: 'VS18', codePoint: 'U+E0101', kind: 'ivs',
  })
  expect(variationSelector('者\u{E0101}ˊ')).toEqual({
    base: '者', selector: '\u{E0101}', sequence: '者\u{E0101}',
    number: 18, tag: 'VS18', codePoint: 'U+E0101', kind: 'ivs',
  })
  expect(variationSelector('艹\uFE00')).toEqual({
    base: '艹', selector: '\uFE00', sequence: '艹\uFE00',
    number: 1, tag: 'VS1', codePoint: 'U+FE00', kind: 'svs',
  })
  expect(variationSelector('\u{18E01}\uFE04')).toEqual({
    base: '\u{18E01}', selector: '\uFE04', sequence: '\u{18E01}\uFE04',
    number: 5, tag: 'VS5', codePoint: 'U+FE04', kind: 'svs',
  })
  expect(variationSelector('者')).toBe(null)
  expect(variationSelector('❤\uFE0F')).toBe(null)
  expect(variationSelector('☺\uFE0E')).toBe(null)
  expect(variationSelector(null)).toBe(null)
})

test('selectorInfo names any single variation selector code point', () => {
  expect(selectorInfo('\uFE00')?.tag).toBe('VS1')
  expect(selectorInfo('\uFE0F')?.kind).toBe('presentation')
  expect(selectorInfo('\u{E0100}')).toEqual({
    selector: '\u{E0100}', number: 17, tag: 'VS17', codePoint: 'U+E0100', kind: 'ivs',
  })
  expect(selectorInfo('\u{E01EF}')?.tag).toBe('VS256')
  expect(selectorInfo('者')).toBe(null)
})

test('parseVariationSelector parses VS numbers and Unicode hex values', () => {
  expect(parseVariationSelector('VS18')?.codePoint).toBe('U+E0101')
  expect(parseVariationSelector('18')?.selector).toBe('\u{E0101}')
  expect(parseVariationSelector('e0101')?.tag).toBe('VS18')
  expect(parseVariationSelector('U+FE00')?.tag).toBe('VS1')
  expect(parseVariationSelector('1')?.codePoint).toBe('U+FE00')
  expect(parseVariationSelector('14')?.codePoint).toBe('U+FE0D')
  expect(parseVariationSelector('15')).toBe(null)
  expect(parseVariationSelector('16')).toBe(null)
  expect(parseVariationSelector('FE0F')).toBe(null)
  expect(parseVariationSelector('257')).toBe(null)
  expect(parseVariationSelector('')).toBe(null)
})
