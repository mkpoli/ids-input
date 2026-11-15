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

/** A sequence's code points as `U+8005 U+E0101`. @param {string} sequence */
export const codePoints = sequence => [...sequence].map(char => `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
