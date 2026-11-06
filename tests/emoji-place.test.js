import { describe, expect, it } from 'bun:test'
import { drawingSvg } from '../src/core/index.js'
import { emojiPlace } from '../src/core/preview.js'

const drawing = { d: 'M0 0L100 0L100 100Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }], stroke: [80, 80] }

describe('emoji-place', () => {

it('places an Emoji at finite numbers whatever its box holds', () => {
  for (const item of [{}, { box: [1, 2] }, { box: [1, 'x', 3, 4] }, null]) {
    const place = emojiPlace(item)
    expect([place.x, place.y, place.size].every(Number.isFinite)).toBe(true)
  }
})
})
