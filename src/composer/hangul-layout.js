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
const W = 0.52

/**
 * Where each letter of one syllable stands, in reading order.
 * @param {string} run a run of jamo: one initial, one or more vowels, any finals
 * @returns {{ letter: string, box: number[], dot?: boolean }[]} each box as fractions `[x0, y0, x1, y1]` of the square
 */
export function hangulBoxes(run, square = true) {
  return hangulLayout(run, square)
}

/** Boxes scaled about the square's centre: a font's letters run a little past the em, and a
 *  composer's glyphs fill about seven tenths of the room they are given.
 * @param {{ letter: string, box: number[], dot?: boolean }[]} boxes @param {number} sx @param {number} [sy] @returns {{ letter: string, box: number[], dot?: boolean }[]} */
const fit = (boxes, sx, sy = sx) => boxes.map(({ letter, box: [x0, y0, x1, y1], dot }) => {
  // A dot keeps its round box; the two axes of a letter's fit would otherwise draw a lozenge.
  const [fx, fy] = dot ? [Math.min(sx, sy), Math.min(sx, sy)] : [sx, sy]
  return { letter, box: [0.5 + (x0 - 0.5) * fx, 0.5 + (y0 - 0.5) * fy, 0.5 + (x1 - 0.5) * fx, 0.5 + (y1 - 0.5) * fy], dot }
})

/** The boxes before the margin is taken. `square` asks for the face's own proportions, used when the
 *  syllable stands alone; a block gives each syllable a half-height box and needs the fill set.
 *  @param {string} run @param {boolean} [square] @returns {{ letter: string, box: number[], dot?: boolean }[]} */
function hangulLayout(run, square = true) {
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
  /** The foot: one consonant takes most of the width, two stand side by side, the first the wider. */
  const foot = () => {
    if (!hasFinal) return
    if (!square) {
      // A block hangs its final under both letters, split evenly.
      place(finals, box(0.18, 0.02, 0.82, 0.32))
      return
    }
    if (finals.length === 1) place(finals, box(0.204, 0.043, 0.791, 0.375))
    else if (finals.length === 2) {
      place(finals.slice(0, 1), box(0.188, 0.047, 0.497, 0.408))
      place(finals.slice(1), box(0.503, 0.047, 0.894, 0.418))
    } else place(finals, box(0.19, 0.045, 0.81, 0.40))
  }

  const top = 1 - M
  if (dots) {
    // ᄀᆞ: the initial above a dot, the final beneath it. The boxes are the ones the face draws
    // (measured from its own syllables), so a run and the font agree.
    out[0].box = square
      ? (hasFinal ? box(0.19, 0.59, 0.80, 0.90) : box(0.18, 0.35, 0.81, 0.86))
      : (hasFinal ? box(0.14, 0.54, 0.86, 0.98) : box(0.14, 0.26, 0.86, 0.98))
    const side = square ? (hasFinal ? 0.088 : 0.112) : 0.15
    for (const letter of vowels) {
      const cy = square ? (hasFinal ? 0.533 : 0.30) : (hasFinal ? 0.475 : 0.115)
      out.push({ letter, box: box(0.5 - side / 2, cy - side / 2, 0.5 + side / 2, cy + side / 2), dot: true })
    }
    foot()
    return fit(out, 1, 1)
  }

  if (beside) {
    // 가: the initial at the left, the vowel a full-height stroke at the right.
    out[0].box = square
      ? (hasFinal ? box(0.13, 0.54, 0.63, 0.91) : box(0.13, 0.26, 0.63, 0.86))
      : (hasFinal ? box(0.02, 0.24, 0.50, 0.90) : box(0.01, 0.12, 0.52, 0.88))
    place(vowels, square
      ? (hasFinal ? box(0.71, 0.49, 0.92, 0.95) : box(0.70, 0.04, 0.93, 0.95))
      : (hasFinal ? box(0.50, 0.34, 0.98, 0.98) : box(0.50, 0.06, 0.98, 0.96)))
    foot()
    return fit(out, 1, 1)
  }

  if (under) {
    // 고: the initial above, the vowel a wide band beneath it.
    out[0].box = hasFinal ? box(0.18, 0.62, 0.81, 0.92) : box(0.18, 0.35, 0.81, 0.86)
    place(vowels, hasFinal ? box(0.10, 0.36, 0.91, 0.58) : box(0.09, 0.17, 0.91, 0.56))
    foot()
    return fit(out, 1, 1)
  }

  // 과: the initial above and to the left, the vowel's glyph filling the right and beneath it.
  out[0].box = hasFinal ? box(0.13, 0.44, 0.59, 0.85) : box(0.13, 0.44, 0.59, 0.85)
  place(vowels, hasFinal ? box(0.08, 0.24, 0.93, 0.95) : box(0.08, 0.04, 0.93, 0.95))
  foot()
  return fit(out, 1, 1)
}
