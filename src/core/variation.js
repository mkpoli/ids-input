// @ts-check
// A component's variation sequence: its character followed by a variation selector (者 U+8005
// U+E0101). The selector chooses a glyph; the loose marks after it stay where they are.
import { isSelector } from './ids.js'
import { splitMarks } from './marks.js'

/**
 * The character whose variation sequences a component may be written as: its one character, any
 * selector dropped. Null for an empty slot, a node, a jamo run or an Emoji sequence.
 * @param {import('./ids.js').Part | undefined} part
 * @returns {string | null}
 */
export function variationBase(part) {
  if (typeof part !== 'string') return null
  const chars = [...String(splitMarks(part).base)]
  // A text or Emoji presentation selector (☺ U+FE0E, ❤ U+FE0F) picks a presentation, not a glyph.
  if (/\p{Extended_Pictographic}/u.test(chars[0] ?? '') || /[\uFE0E\uFE0F]/.test(chars[1] ?? '')) return null
  if (chars.length === 1) return isSelector(chars[0]) ? null : chars[0]
  return chars.length === 2 && isSelector(chars[1]) ? chars[0] : null
}

/** The component as written without its marks: its character and any selector. @param {string} part */
export const variationOf = part => String(splitMarks(part).base)

/**
 * `part` written as `sequence` (its character, or the character and a selector), its marks kept.
 * @param {string} part @param {string} sequence
 */
export const withVariation = (part, sequence) => sequence + splitMarks(part).marks

/**
 * @typedef {object} VariationSelectorInfo
 * @property {string} base The base character without its variation selector.
 * @property {string} selector The variation selector character itself.
 * @property {string} sequence The base character followed by its variation selector.
 * @property {number} number The Unicode variation selector number (1–14, 17–256).
 * @property {string} tag Short label such as `VS1` or `VS18`.
 * @property {string} codePoint Code point notation of the selector, such as `U+FE00` or `U+E0101`.
 * @property {'ivs' | 'svs'} kind `ivs` for Ideographic Variation Selectors (U+E0100–U+E01EF), `svs` for Standardized Variation Selectors (U+FE00–U+FE0D).
 */

/**
 * The variation selector carried by `part`, or null where it carries none (or carries a text/Emoji
 * presentation selector).
 * @param {import('./ids.js').Part | undefined} part
 * @returns {VariationSelectorInfo | null}
 */
export function variationSelector(part) {
  const base = variationBase(part)
  if (base === null || typeof part !== 'string') return null
  const sequence = variationOf(part)
  const chars = [...sequence]
  if (chars.length !== 2 || !isSelector(chars[1])) return null
  const selector = chars[1]
  const point = /** @type {number} */ (selector.codePointAt(0))
  const ivs = point >= 0xE0100
  const number = ivs ? point - 0xE0100 + 17 : point - 0xFE00 + 1
  return {
    base,
    selector,
    sequence,
    number,
    tag: `VS${number}`,
    codePoint: `U+${point.toString(16).toUpperCase().padStart(4, '0')}`,
    kind: ivs ? 'ivs' : 'svs',
  }
}

/**
 * Details of a single variation selector code point (`U+FE00`–`U+FE0F` or `U+E0100`–`U+E01EF`), or
 * null for any other character.
 * @param {string | undefined} char
 * @returns {{ selector: string, number: number, tag: string, codePoint: string, kind: 'ivs' | 'svs' | 'presentation' } | null}
 */
export function selectorInfo(char) {
  if (!isSelector(char)) return null
  const selector = /** @type {string} */ (char)
  const point = /** @type {number} */ (selector.codePointAt(0))
  const ivs = point >= 0xE0100
  const number = ivs ? point - 0xE0100 + 17 : point - 0xFE00 + 1
  const kind = ivs ? 'ivs' : (point === 0xFE0E || point === 0xFE0F) ? 'presentation' : 'svs'
  return {
    selector,
    number,
    tag: `VS${number}`,
    codePoint: `U+${point.toString(16).toUpperCase().padStart(4, '0')}`,
    kind,
  }
}

/**
 * Parse a user-typed variation selector (`VS18`, `18`, `E0101`, `U+E0101`, `VS1`, `FE00`) into its
 * selector character and metadata. Rejects text/Emoji presentation selectors (`VS15`, `VS16`,
 * `U+FE0E`, `U+FE0F`) and out-of-range values.
 * @param {string} input
 * @returns {{ selector: string, number: number, tag: string, codePoint: string, kind: 'ivs' | 'svs' } | null}
 */
export function parseVariationSelector(input) {
  const trimmed = input.trim().toUpperCase()
  if (!trimmed) return null
  /** @type {number | null} */
  let point = null
  const vsMatch = /^(?:VS)?(\d{1,3})$/.exec(trimmed)
  if (vsMatch) {
    const n = Number(vsMatch[1])
    if (n >= 1 && n <= 14) point = 0xFE00 + (n - 1)
    else if (n >= 17 && n <= 256) point = 0xE0100 + (n - 17)
  } else {
    const hexMatch = /^(?:U\+)?([0-9A-F]{4,6})$/.exec(trimmed)
    if (hexMatch) {
      const value = parseInt(hexMatch[1], 16)
      if ((value >= 0xFE00 && value <= 0xFE0D) || (value >= 0xE0100 && value <= 0xE01EF)) point = value
    }
  }
  if (point === null) return null
  const info = selectorInfo(String.fromCodePoint(point))
  if (!info || info.kind === 'presentation') return null
  return /** @type {{ selector: string, number: number, tag: string, codePoint: string, kind: 'ivs' | 'svs' }} */ (info)
}

/** A sequence's code points as `U+8005 U+E0101`. @param {string} sequence */
export const codePoints = sequence => [...sequence].map(char => `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
