import { describe, expect, it } from 'bun:test'
import { drawingSvg } from '../src/core/index.js'

const drawing = { d: 'M0 0L100 0L100 100Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }], stroke: [80, 80] }

describe('emoji-parts', () => {

it('draws every Emoji of a part, and one that names a part the drawing lacks', () => {
  const svg = drawingSvg({
    d: '',
    parts: [{ d: 'M0 0L1 1Z', leaf: 0 }],
    emoji: [{ text: '😀', box: [0, 0, 9, 9], part: 0 }, { text: '😁', box: [0, 0, 9, 9], part: 0 }, { text: '🙂', box: [0, 0, 9, 9], part: 9 }],
  })
  for (const text of ['😀', '😁', '🙂']) expect(svg).toContain(text)
})
})

it("keeps a valid Emoji in its part's turn when another names no part", () => {
  const svg = drawingSvg({
    d: '',
    parts: [{ d: '', leaf: 0 }, { d: 'M0 0L1 1Z', leaf: 1 }],
    emoji: [{ text: '😀', box: [0, 0, 9, 9], part: 0 }, { text: '🙂', box: [0, 0, 9, 9], part: 9 }],
  })
  expect(svg.indexOf('😀')).toBeLessThan(svg.indexOf('<path'))
  expect(svg).toContain('🙂')
  expect(svg.split('😀')).toHaveLength(2)
})
