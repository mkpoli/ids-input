import { expect, test } from 'bun:test'
import { tokens, tint, rangeToken } from '../src/svelte/tokens.js'

// A supplementary character and a variation selector: built from code points, so the source can hold
// neither a literal surrogate pair nor an escape a tool over the text might rewrite.
const SEAL = String.fromCodePoint(0x20000), VS = String.fromCodePoint(0xE0100)
/** The UTF-16 index just past the unit at `at`. @param {string} text @param {number} at */
const after = (text, at) => at + (text.codePointAt(at) > 0xFFFF ? 2 : 1)

test('tokens map nested subtrees with UTF-16 ranges', () => {
  const text = '⿰⿱木' + SEAL + VS + '水'
  const spans = tokens(text)
  expect(spans.map(t => t.path)).toEqual([[], [0], [0, 0], [0, 1], [1]])
  expect(text.slice(spans[1].start, spans[1].end)).toBe('⿱木' + SEAL + VS)
  expect(spans[3].text).toBe(SEAL + VS)
  expect(spans.map(t => t.text).join('')).toBe(text)
})
test('tokens keep a conjoining Hangul run whole', () => {
  const cluster = String.fromCodePoint(0x1100, 0x1161, 0x11eb), text = `⿰${cluster}木`
  const spans = tokens(text)
  expect(spans.map(token => token.text)).toEqual(['⿰', cluster, '木'])
  expect(spans.at(-1)).toMatchObject({ path: [1], start: 1 + cluster.length, end: text.length })
  expect(spans.map(token => token.text).join('')).toBe(text)
})
test('an operator short of operands has a zero-width token for each one', () => {
  expect(tokens('⿳').map(token => [token.path, token.text, token.start, token.end])).toEqual([
    [[], '⿳', 0, 1], [[0], '', 1, 1], [[1], '', 1, 1], [[2], '', 1, 1],
  ])
  expect(tokens('⿳木').map(token => [token.path, token.text, token.start, token.end])).toEqual([
    [[], '⿳', 0, 2], [[0], '木', 1, 2], [[1], '', 2, 2], [[2], '', 2, 2],
  ])
})
test('unfinished slots have zero width; invalid drafts are unmapped', () => {
  expect(tokens('⿰木').at(-1)).toMatchObject({ path: [1], start: 2, end: 2, text: '' })
  expect(tokens('⿰木木木')).toEqual([])
  expect(tokens('⿰木!').map(token => token.text)).toEqual(['⿰', '木', '!'])
  expect(tokens('')).toEqual([])
})
test('layer tints are stable, and an operator shares its operands’ hue', () => {
  expect(tint([0])).toBe(tint([1]))
  expect(tint([0, 0])).toBe(tint([0, 1]))
  expect(tint([0], true)).toBe(tint([0, 0]))
  expect(tint([0], true)).not.toBe(tint([0]))
  expect(tint([0, 0])).not.toBe(tint([1, 0]))
  expect(tint([], true)).toBe(tint([]))
})

test('ranges select the smallest enclosing subtree without splitting selectors', () => {
  const text = '⿰⿱木' + SEAL + VS + '水'
  const spans = tokens(text)
  // Inside the sealed component's text but not all of it: the smallest part is that component.
  expect(rangeToken(spans, 3, 4)?.path).toEqual([0, 1])
  expect(rangeToken(spans, 2, after(text, 4))?.path).toEqual([0])
  // Across the root's parts, past the operator that halves them: only the root holds it.
  expect(rangeToken(spans, 2, spans.at(-1).end)?.path).toEqual([])
  expect(rangeToken(spans, 2, 2)).toBeNull()
})

test('treats an emoji sequence as one selectable token', () => {
  const spans = tokens('⿰👩🏽‍💻木')
  expect(spans.map(token => token.text)).toEqual(['⿰', '👩🏽‍💻', '木'])
  // The whole Emoji, from its first code point to its last.
  expect(rangeToken(spans, 1, [...spans[1].text].length + 1)?.path).toEqual([0])
})

test('a modifier stays with its operator, and a range inside it names no part', () => {
  const text = '⿴[1]囗水'
  const spans = tokens(text)
  expect(spans.map(t => t.text)).toEqual(['⿴[1]', '囗', '水'])
  expect(spans[0]).toMatchObject({ noteStart: 1, noteEnd: 4 })
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
  expect(tokens('⿰#(H)' + VS + '木').map(t => t.text)).toEqual(['⿰', '#(H)' + VS, '木'])
})
