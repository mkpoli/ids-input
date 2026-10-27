// @ts-check
// Hangul jamo composition. A modern initial, medial and final compose to one precomposed syllable
// in the Hangul Syllable block. Old Hangul combinations stay a run of conjoining jamo, which fonts
// shape into one syllable; Unicode does not precompose them.

/** @typedef {'L' | 'V' | 'T'} JamoClass */
/** @typedef {{ text: string, precomposed: boolean }} Composed */

/** @type {ReadonlyArray<readonly [JamoClass, number, number]>} */
const RANGES = [
  ['L', 0x1100, 0x115e], ['L', 0xa960, 0xa97c],
  ['V', 0x1161, 0x11a7], ['V', 0xd7b0, 0xd7c6],
  ['T', 0x11a8, 0x11ff], ['T', 0xd7cb, 0xd7fb],
]
/** Choseong and jungseong fillers do not form a syllable. */
const FILLERS = new Set([0x115f, 0x1160])
const toChars = (/** @type {number} */ first, /** @type {number} */ last) =>
  Array.from({ length: last - first + 1 }, (_, i) => String.fromCodePoint(first + i))

/** The jamo a combiner offers, modern first. */
export const HANGUL_INITIALS = {
  modern: toChars(0x1100, 0x1112),
  historical: [...toChars(0x1113, 0x115e), ...toChars(0xa960, 0xa97c)],
}
export const HANGUL_MEDIALS = {
  modern: toChars(0x1161, 0x1175),
  historical: [...toChars(0x1176, 0x11a7), ...toChars(0xd7b0, 0xd7c6)],
}
export const HANGUL_FINALS = {
  modern: toChars(0x11a8, 0x11c2),
  historical: [...toChars(0x11c3, 0x11ff), ...toChars(0xd7cb, 0xd7fb)],
}

// Compatibility jamo are in the same order as the modern conjoining jamo of their class.
/** @param {string} letters @param {number} first @returns {Map<number, number>} */
const compatibility = (letters, first) => new Map([...letters].map((letter, i) => [letter.codePointAt(0) ?? 0, first + i]))
const COMPATIBILITY = {
  L: compatibility('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', 0x1100),
  V: compatibility('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', 0x1161),
  T: compatibility('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ', 0x11a8),
}

/** The class of a conjoining jamo, or null for anything else. @param {string | undefined} char @returns {JamoClass | null} */
export function jamoClass(char) {
  const cp = char?.codePointAt(0)
  if (cp === undefined || FILLERS.has(cp)) return null
  for (const [role, first, last] of RANGES) if (cp >= first && cp <= last) return role
  return null
}

/** `char` as a conjoining jamo for `role`, mapping compatibility jamo; null when it cannot take that role.
 * @param {string | undefined} char @param {JamoClass} role @returns {string | null} */
export function toConjoiningJamo(char, role) {
  if (!char) return null
  if (jamoClass(char) === role) return char
  const cp = char.codePointAt(0)
  const mapped = cp === undefined ? undefined : COMPATIBILITY[role].get(cp)
  return mapped === undefined ? null : String.fromCodePoint(mapped)
}

/** The conjoining jamo run starting at `at` that forms one syllable, or null. The run is L* V+ T*.
 * @param {string[]} chars @param {number} at @returns {{ text: string, end: number } | null} */
export function hangulClusterAt(chars, at) {
  if (jamoClass(chars[at]) !== 'L') return null
  let end = at
  while (jamoClass(chars[end]) === 'L') end++
  if (jamoClass(chars[end]) !== 'V') return null
  while (jamoClass(chars[end]) === 'V') end++
  while (jamoClass(chars[end]) === 'T') end++
  return { text: chars.slice(at, end).join(''), end }
}

/** Compose an initial, a medial and an optional final. A modern triple becomes one precomposed
 * syllable; any other valid combination becomes its conjoining jamo run.
 * @param {string} initial @param {string} medial @param {string} [final] @returns {Composed | null} */
export function composeHangul(initial, medial, final = '') {
  if ([...initial].length !== 1 || [...medial].length !== 1 || [...final].length > 1) return null
  const l = toConjoiningJamo(initial, 'L'), v = toConjoiningJamo(medial, 'V')
  const t = final ? toConjoiningJamo(final, 'T') : ''
  if (!l || !v || final && !t) return null
  const lc = l.codePointAt(0) ?? 0, vc = v.codePointAt(0) ?? 0, tc = t ? t.codePointAt(0) ?? 0 : 0
  if (lc >= 0x1100 && lc <= 0x1112 && vc >= 0x1161 && vc <= 0x1175 && (!t || tc >= 0x11a8 && tc <= 0x11c2)) {
    const syllable = 0xac00 + ((lc - 0x1100) * 21 + (vc - 0x1161)) * 28 + (t ? tc - 0x11a7 : 0)
    return { text: String.fromCodePoint(syllable), precomposed: true }
  }
  return { text: l + v + t, precomposed: false }
}

/** One syllable composed from compatibility or conjoining jamo, or null. Used by filters that accept
 * jamo as they are typed. @param {string} text @returns {string | null} */
export function composeJamo(text) {
  const chars = [...text]
  if (chars.length < 2) return null
  const cluster = hangulClusterAt(chars, 0)
  if (cluster && cluster.end === chars.length) {
    const text = cluster.text.normalize('NFC')
    return [...text].length === 1 ? text : cluster.text
  }
  const initial = toConjoiningJamo(chars[0], 'L'), medial = toConjoiningJamo(chars[1], 'V')
  if (!initial || !medial) return null
  const finals = chars.slice(2).map(char => toConjoiningJamo(char, 'T'))
  if (finals.length > 1 || finals.some(char => char === null)) return null
  return composeHangul(initial, medial, finals.join(''))?.text ?? null
}
