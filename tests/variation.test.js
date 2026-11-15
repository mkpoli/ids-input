import { expect, test } from 'bun:test'
import { codePoints, variationBase, variationOf, withVariation } from '../src/core/variation.js'

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
