import { expect, test } from 'bun:test'
import { tokens, tint } from '../src/svelte/tokens.js'

test('tokens map nested subtrees with UTF-16 ranges', () => {
  const text = '⿰⿱木𠀀\u{E0100}水'
  const spans = tokens(text)
  expect(spans.map(t => t.path)).toEqual([[], [0], [0, 0], [0, 1], [1]])
  expect(text.slice(spans[1].start, spans[1].end)).toBe('⿱木𠀀\u{E0100}')
  expect(spans[3].text).toBe('𠀀\u{E0100}')
  expect(spans.map(t => t.text).join('')).toBe(text)
})
test('unfinished slots have zero width; invalid drafts are unmapped', () => {
  expect(tokens('⿰木').at(-1)).toMatchObject({path: [1], start: 2, end: 2, text: ''})
  expect(tokens('⿰木!')).toEqual([])
  expect(tokens('')).toEqual([])
})
test('branch tints are stable and distinct', () => {
  expect(tint([0])).toBe(tint([0]))
  expect(tint([0])).not.toBe(tint([1]))
  expect(tint([0, 0])).not.toBe(tint([0, 1]))
})
