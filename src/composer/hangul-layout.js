// @ts-check
// Where the letters of a Hangul syllable go. A syllable is an initial, a vowel and an optional
// final; the vowel's own shape decides the arrangement, and Unicode's 配置 names the six that
// occur: an initial beside a vertical vowel (가), above a horizontal one (고), above and beside a
// mixed one (과), above the 아래아 (ᄀᆞ), each with or without a final beneath. A final of two
// consonants stands side by side, the pair sharing the foot. Nothing here depends on which letters
// are involved, so the same boxes serve every syllable Unicode can spell and every run beyond it.

/** Vowel jamo that stand at the right of the initial. */
const VERTICAL = new Set(['\u1161', '\u1162', '\u1163', '\u1164', '\u1165', '\u1166', '\u1167', '\u1168', '\u1175'])
/** Vowel jamo that lie under the initial. */
const HORIZONTAL = new Set(['\u1169', '\u116d', '\u116e', '\u1172', '\u1173'])
/** Vowels drawn with a stroke at the right and a stroke beneath: ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ. */
const MIXED = new Set(['\u116a', '\u116b', '\u116c', '\u116f', '\u1170', '\u1171', '\u1174'])

/** Whether a vowel keeps a band beneath its initial rather than a strip beside it. @param {string} letter @returns {boolean} */
export const liesUnder = letter => HORIZONTAL.has(letter) || MIXED.has(letter) || !(VERTICAL.has(letter) || HORIZONTAL.has(letter) || MIXED.has(letter))

/** @param {number} a @param {number} b @param {number} c @param {number} d @returns {number[]} */
const box = (a, b, c, d) => [a, b, c, d]

// Fractions of the syllable's square, y measured up from the foot. One margin, one gap and one
// foot height serve every arrangement, so the six 配置 read as one family.
const M = 0.05
const G = 0.03
/** The foot a final claims, from the bottom margin up. */
const FOOT = [0.04, 0.30]
/** How wide one letter stands at the foot; a pair sets two of these with a gap between. */
const W = 0.40

/**
 * Where each letter of one syllable stands, in reading order.
 * @param {string} run a run of jamo: one initial, one or more vowels, any finals
 * @returns {{ letter: string, box: number[], dot?: boolean }[]} each box as fractions `[x0, y0, x1, y1]` of the square
 */
export function hangulBoxes(run) {
  const chars = [...run]
  /** @param {string} char @returns {'L' | 'V' | 'T'} */
  const kind = char => (/[\u1100-\u115e\u{a960}-\u{a97c}]/u.test(char) ? 'L' : /[\u1161-\u11a7\u{d7b0}-\u{d7c6}]/u.test(char) ? 'V' : 'T')
  let at = 0
  const initial = kind(chars[0]) === 'L' ? chars[at++] : ''
  /** @type {string[]} */ const vowels = []
  while (chars[at] && kind(chars[at]) === 'V') vowels.push(chars[at++])
  /** @type {string[]} */ const finals = []
  while (chars[at] && kind(chars[at]) === 'T') finals.push(chars[at++])
  // A bare letter — a column gives each of its letters its own slot — fills the slot it is given.
  if (!initial) return chars.map((letter, i) => ({ letter, box: box(i / chars.length, 0, (i + 1) / chars.length, 1) }))
  // A letter alone — a column gives each its own slot — takes the whole slot, margins and all.
  if (!vowels.length) return [{ letter: initial, box: box(0, 0, 1, 1) }]

  const hasFinal = finals.length > 0
  const beside = vowels.every(letter => VERTICAL.has(letter))
  const under = vowels.every(letter => HORIZONTAL.has(letter))
  const dots = vowels.every(letter => !VERTICAL.has(letter) && !HORIZONTAL.has(letter) && !MIXED.has(letter))
  /** @type {{ letter: string, box: number[], dot?: boolean }[]} */
  const out = [{ letter: initial, box: [0, 0, 1, 1] }]

  /** Split `slot` between `group`'s letters, in reading order. @param {string[]} group @param {number[]} slot */
  const place = (group, slot) => {
    const [sx0, sy0, sx1, sy1] = slot, n = group.length
    group.forEach((letter, i) => {
      out.push({ letter, box: [sx0 + ((sx1 - sx0) * i) / n, sy0, sx0 + ((sx1 - sx0) * (i + 1)) / n, sy1] })
    })
  }
  /** The foot: one consonant takes a letter's width, two stand side by side on the same line. */
  const foot = () => {
    if (!hasFinal) return
    const [fy0, fy1] = FOOT
    if (finals.length === 1) place(finals, box((1 - W) / 2, fy0, (1 + W) / 2, fy1))
    else if (finals.length === 2) {
      // A double patchim takes most of the foot, each consonant a near-square of its own.
      const half = 0.15
      place(finals.slice(0, 1), box(0.5 - G / 2 - half, fy0, 0.5 - G / 2, fy1))
      place(finals.slice(1), box(0.5 + G / 2, fy0, 0.5 + G / 2 + half, fy1))
    } else place(finals, box((1 - W) / 2, fy0, (1 + W) / 2, fy1))
  }

  const top = 1 - M
  if (dots) {
    // ᄀᆞ: the initial above a round dot, the final beneath it.
    out[0].box = hasFinal ? box(0.14, 0.54, 0.86, 0.98) : box(0.14, 0.26, 0.86, 0.98)
    const side = 0.15
    for (const letter of vowels) {
      const cy = hasFinal ? 0.475 : 0.115
      out.push({ letter, box: box(0.5 - side / 2, cy - side / 2, 0.5 + side / 2, cy + side / 2), dot: true })
    }
    foot()
    return out
  }

  if (beside) {
    // 가: initial at the left, vowel at the right, both taking the height above the foot.
    out[0].box = hasFinal ? box(0.02, 0.24, 0.50, 0.90) : box(0.01, 0.12, 0.52, 0.88)
    place(vowels, hasFinal ? box(0.50, 0.34, 0.98, 0.98) : box(0.50, 0.06, 0.98, 0.96))
    foot()
    return out
  }

  if (under) {
    // 고: initial above, vowel beneath, the pair sharing the height above the foot.
    out[0].box = hasFinal ? box(0.20, 0.70, 0.80, top) : box(0.20, 0.55, 0.80, top)
    place(vowels, hasFinal ? box(M, 0.40, 1 - M, 0.66) : box(M, 0.10, 1 - M, 0.48))
    foot()
    return out
  }

  // 과: the initial above and to the left, the vowel's own glyph at the right and beneath it, its
  // ink lying low and to the right so the two share the square.
  out[0].box = box(M, 0.52, 0.50, top)
  place(vowels, hasFinal ? box(0.10, 0.34, 1 - M, 0.92) : box(0.10, 0.06, 1 - M, 0.90))
  foot()
  return out
}
