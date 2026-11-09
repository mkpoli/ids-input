import { expect, it } from 'bun:test'
import { characterStrokes, componentStrokes, parse } from '../src/core/index.js'

const counts = new Map([['木', 4], ['口', 3], ['田', 5], ['土', 3], ['艹', 3], ['曷', 9], ['林', 8], ['森', 12], ['亻', 2], ['建', 9]])
const count = char => counts.get(char) ?? null
const at = (text) => componentStrokes(parse(text, { open: true }).tree, count)
const shown = (text, encoded) => characterStrokes(parse(text, { open: true }).tree, count, encoded)

it('adds the recorded count of every component', () => {
  expect(at('⿰木木')).toEqual({ components: 2, strokes: 8, filled: true })
  expect(at('⿱木⿰木木')).toEqual({ components: 3, strokes: 12, filled: true })
  expect(at('⿰木口')).toEqual({ components: 2, strokes: 7, filled: true })
  expect(at('木')).toEqual({ components: 1, strokes: 4, filled: true })
  // A whole character adds its own count, not a count of its parts.
  expect(at('森')).toEqual({ components: 1, strokes: 12, filled: true })
})

it('keeps the count unknown while a slot, a placeholder or a failed parse stands there', () => {
  expect(at('⿰木⬚')).toEqual({ components: 1, strokes: null, filled: false })
  expect(at('⿰木？')).toEqual({ components: 1, strokes: null, filled: false })
  expect(at('⿰{木}木')).toEqual({ components: 0, strokes: null, filled: false })
  expect(at('')).toEqual({ components: 0, strokes: null, filled: false })
})

it('reports a filled description whose component has no recorded count', () => {
  expect(at('⿰木X')).toEqual({ components: 2, strokes: null, filled: true })
})

it('counts a component once per use, past its loose marks and variation selector', () => {
  expect(at('⿰木木ˊ')).toEqual({ components: 2, strokes: 8, filled: true })
  expect(at('⿱艹曷\u{E0100}')).toEqual({ components: 2, strokes: 12, filled: true })
})

it('shows a recorded character count ahead of the components’ sum', () => {
  // 健 is 10 strokes; 亻 (2) and 建 (9) add up to 11.
  expect(shown('⿰亻建', [10])).toEqual({ components: 2, strokes: 10, approximate: false })
  expect(shown('⿰亻建', [])).toEqual({ components: 2, strokes: 11, approximate: true })
  // 里 is 7 strokes; 田 (5) and 土 (3) add up to 8.
  expect(shown('⿱田土', [7])).toEqual({ components: 2, strokes: 7, approximate: false })
  // A single component is its own character, whatever the encoded list says.
  expect(shown('木', [4])).toEqual({ components: 1, strokes: 4, approximate: false })
  expect(shown('木')).toEqual({ components: 1, strokes: 4, approximate: false })
})

it('falls back to the sum when encoded characters disagree or lack a count', () => {
  expect(shown('⿰木木', [8, 8])).toEqual({ components: 2, strokes: 8, approximate: false })
  expect(shown('⿰木木', [8, 7])).toEqual({ components: 2, strokes: 8, approximate: true })
  expect(shown('⿰木木', [8, null])).toEqual({ components: 2, strokes: 8, approximate: true })
  expect(shown('⿰木木')).toEqual({ components: 2, strokes: 8, approximate: true })
})

it('shows a filled component count without a stroke total, and nothing for a draft', () => {
  expect(shown('⿰木X')).toEqual({ components: 2, strokes: null, approximate: false })
  expect(shown('⿰木⬚', [8])).toBeNull()
  expect(shown('')).toBeNull()
})
