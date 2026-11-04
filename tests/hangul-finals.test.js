import { describe, expect, test } from 'bun:test'
import { COMPOUND_FINALS } from '../src/core/hangul.js'

describe('Compound finals', () => {
  test('names the two consonants of every double patchim', () => {
    expect([...COMPOUND_FINALS.keys()]).toHaveLength(11)
    expect(COMPOUND_FINALS.get('\u11b0')).toEqual(['\u11af', '\u11a8']) // ㄺ
    expect(COMPOUND_FINALS.get('\u11b9')).toEqual(['\u11b8', '\u11ba']) // ㅄ
  })

  test('keeps every part a final the face can draw', () => {
    for (const [whole, parts] of COMPOUND_FINALS) {
      expect(whole >= '\u11a8' && whole <= '\u11ff').toBe(true)
      for (const part of parts) expect(part >= '\u11a8' && part <= '\u11ff').toBe(true)
    }
  })
})
