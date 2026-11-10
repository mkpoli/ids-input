// @ts-check
// zi.tools writes a stroke chain where a description has no character to name: #(H) for 一, #(Wg)
// for ㇁, #(-丨𠃍-一z) for 口. The chain writes its strokes in writing order, each joined to the
// last; a character's own description uses one where its strokes have no smaller parts.
//
// The published grammar lists the chains that name a stroke or a character (the compound strokes,
// the single stroke letters, and the characters whose own description is a chain). Those read as
// that character. Any other chain describes a shape the composer cannot draw yet, and stays text.
// Source: NightFurySL2001, （白式）IDS 延展语法导论, <https://nightfurySl2001.github.io/bai-ids/>,
// §5.3, read 2026-10-28. Its examples: https://zi.tools/?secondary=ids.
//
// The chains themselves are the engine's: a description's chain and the field's are one notation.
import { STROKE_CHAINS } from '@han-compose/composer/tree'

/** The character a chain's contents name, or undefined where they name none. @param {string} text */
export const strokeChainChar = text => STROKE_CHAINS[text]

/**
 * The character a stroke chain starting at `chars[at]` names, and where the chain ends, or null
 * where no chain starts there or the chain names none.
 * @param {string[]} chars @param {number} at @returns {{ char: string, end: number } | null}
 */
export function strokeChain(chars, at) {
  if (chars[at] !== '#' || chars[at + 1] !== '(') return null
  const close = chars.indexOf(')', at + 2)
  if (close < 0 || close - at > 40) return null
  const char = STROKE_CHAINS[chars.slice(at + 2, close).join('')]
  return char === undefined ? null : { char, end: close + 1 }
}

/**
 * How many UTF-16 units the chain at `text[at]` takes, 0 where none names a character.
 * @param {string} text @param {number} at @returns {number}
 */
export function strokeChainLength(text, at) {
  if (text[at] !== '#' || text[at + 1] !== '(') return 0
  const close = text.indexOf(')', at + 2)
  if (close < 0 || close - at > 40) return 0
  return STROKE_CHAINS[text.slice(at + 2, close)] === undefined ? 0 : close - at + 1
}
