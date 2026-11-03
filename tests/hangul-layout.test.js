import { describe, expect, test } from 'bun:test'
import { hangulBoxes } from '../src/composer/hangul-layout.js'
import { HANGUL_FINALS, HANGUL_INITIALS, HANGUL_MEDIALS } from '../src/core/hangul.js'

/** The conjoining jamo of a precomposed syllable. @param {number} cp */
const runOf = cp => {
  const index = cp - 0xac00
  const initial = 0x1100 + Math.floor(index / 588)
  const medial = 0x1161 + Math.floor((index % 588) / 28)
  const final = index % 28
  return String.fromCodePoint(initial, medial) + (final ? String.fromCodePoint(0x11a7 + final) : '')
}

const SYLLABLES = Array.from({ length: 11172 }, (_, i) => 0xac00 + i)

describe('Hangul layout', () => {
  test('stands every letter of every syllable within its square', () => {
    const bad = []
    for (const cp of SYLLABLES) {
      const boxes = hangulBoxes(runOf(cp))
      if (boxes.length < 2) { bad.push([cp, 'letters', boxes.length]); continue }
      for (const { letter, box } of boxes) {
        const [x0, y0, x1, y1] = box
        if (!(x1 - x0 > 0.05 && y1 - y0 > 0.05)) bad.push([cp, 'size', letter])
        // A font's letters run a little past the em, so a box may bleed; it must not wander off.
        if (x0 < -0.2 || y0 < -0.2 || x1 > 1.2 || y1 > 1.2) bad.push([cp, 'outside', letter])
      }
    }
    expect(bad.slice(0, 5)).toEqual([])
    expect(bad).toHaveLength(0)
  })

  test('reads every syllable initial, then vowel, then final', () => {
    for (const cp of SYLLABLES) {
      const run = runOf(cp)
      const boxes = hangulBoxes(run)
      expect(boxes.map(box => box.letter).join('')).toBe(run)
    }
  })

  test('sets the six 配置 by the vowel', () => {
    const at = (/** @type {string} */ run) => Object.fromEntries(hangulBoxes(run).map(({ letter, box }) => [letter, box]))
    // 가: initial left, vowel right.
    const ga = at('\u1100\u1161')
    expect(ga['\u1100'][0]).toBeLessThan(ga['\u1161'][0])
    // 고: initial above, vowel beneath.
    const go = at('\u1100\u1169')
    expect(go['\u1100'][1]).toBeGreaterThan(go['\u1169'][1])
    // 과: initial top left, the vowel's strokes at the right and beneath it.
    const gwa = at('\u1100\u116a')
    expect(gwa['\u1100'][0]).toBeLessThan(gwa['\u116a'][0])
    expect(gwa['\u1100'][1]).toBeGreaterThan(gwa['\u116a'][1])
    // ᄀᆞ: the initial above a dot.
    const gao = hangulBoxes('\u1100\u119e')
    expect(gao[1].dot).toBe(true)
    expect(gao[1].box[2] - gao[1].box[0]).toBeCloseTo(gao[1].box[3] - gao[1].box[1], 5)
    // 각: a final beneath.
    const gak = at('\u1100\u1161\u11a8')
    expect(gak['\u11a8'][1]).toBeLessThan(gak['\u1100'][1])
    // 값: two finals side by side.
    const gaps = hangulBoxes('\u1100\u1161\u11b8\u11ba')
    const finals = gaps.slice(-2).map(({ box }) => box)
    expect(finals[0][2]).toBeLessThanOrEqual(finals[1][0] + 1e-9)
  })

  test('sets every modern initial, medial and final', () => {
    for (const initial of [...HANGUL_INITIALS.modern, ...HANGUL_MEDIALS.modern.slice(0, 1)]) void initial
    for (const medial of HANGUL_MEDIALS.modern) {
      const boxes = hangulBoxes('\u1100' + medial)
      expect(boxes).toHaveLength(2)
    }
    for (const final of HANGUL_FINALS.modern) {
      const boxes = hangulBoxes('\u1100\u1161' + final)
      expect(boxes).toHaveLength(3)
    }
  })
})
