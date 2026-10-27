import { expect, test } from 'bun:test'
import { tokens, tint, rangeToken } from '../src/svelte/tokens.js'

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
  expect(tokens('⿰木木木')).toEqual([])
  expect(tokens('⿰木!').map(token => token.text)).toEqual(['⿰', '木', '!'])
  expect(tokens('')).toEqual([])
})
test('branch tints are stable and distinct', () => {
  expect(tint([0])).toBe(tint([0]))
  expect(tint([0])).not.toBe(tint([1]))
  expect(tint([0, 0])).not.toBe(tint([0, 1]))
})

test('ranges select the smallest enclosing subtree without splitting selectors', () => {
  const spans = tokens('⿰⿱木𠀀\u{E0100}水')
  expect(rangeToken(spans, 3, 4)?.path).toEqual([0, 1])
  expect(rangeToken(spans, 2, 7)?.path).toEqual([0])
  expect(rangeToken(spans, 2, 8)?.path).toEqual([])
  expect(rangeToken(spans, 2, 2)).toBeNull()
})

test('a modifier stays with its operator, and a range inside it names no part', () => {
  const text = '⿴[1]囗水'
  const spans = tokens(text)
  expect(spans.map(t => t.text)).toEqual(['⿴[1]', '囗', '水'])
  expect(spans[0]).toMatchObject({ path: [], start: 0, text: '⿴[1]' })
  expect(rangeToken(spans, 1, 4)).toBeNull()
  expect(rangeToken(spans, 0, 4)?.path).toEqual([])
})

test('a stroke chain that names a character is one token, the chain as written', () => {
  const text = '⿰#(H)木'
  const spans = tokens(text)
  expect(spans.map(t => t.text)).toEqual(['⿰', '#(H)', '木'])
  expect(spans.map(t => t.path)).toEqual([[], [0], [1]])
  expect(text.slice(spans[0].start, spans[0].end)).toBe(text)
  // A variation selector written after the chain stays in its token.
  expect(tokens('⿰#(H)\u{E0100}木').map(t => t.text)).toEqual(['⿰', '#(H)\u{E0100}', '木'])
})
