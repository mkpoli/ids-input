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

/**
 * The chains that name a character, each without `#(` and `)`. A chain's letters are its strokes:
 * H 横, S 竖, P 撇, N 捺, D 点, T 提, J, Z, Wg 弯钩, Qa–Qd 曲; `-` reverses a stroke, `b` breaks a
 * stroke, `x` crosses an earlier one, `w` rounds a joint, and a closing `z` joins the ends.
 * @type {Readonly<Record<string, string>>}
 */
export const STROKE_CHAINS = {
  // One stroke: the letters, the leftward Z and the four quarter curves Qa–Qd.
  H: '一', S: '丨', P: '丿', N: '乀', D: '丶', T: '㇀', SZ: '㇘',
  Qa: '◝', Qb: '◞', Qc: '◟', Qd: '◜',
  // Compound strokes.
  HNg: '⺄', Wg: '㇁', Ng: '㇂', SHw: '㇄', HSH: '㇅', HP: '㇇', HSHwg: '㇈', SHSg: '㇉',
  HST: '㇊', HSHP: '㇋', HPWg: '㇌', HSHw: '㇍', HSHS: '㇎', HN: '乁', J: '㇝', Pg: '㇢',
  HPHwg: '乙', SHwg: '乚', Hg: '乛', Sg: '亅', SH: '𠃊', PH: '𠃋', HSg: '𠃌', HS: '𠃍',
  SHS: '𠃑', ST: '𠄌', HSHSg: '𠄎', '◟◜◝◞z': '〇',
  // Characters the grammar draws with a chain.
  '丿丿': '𠂆', '-一𠃊': '匚', '-𠃊㇈': '𠤬', '-𠃊㇎z': '𱍫', '𠃍-一㇉': '弓', '𠃍-一乚': '己',
  '一-𠃍乚': '巳', '-丨𠃍-一z': '口', '-乀x1㇇': '又',
}

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
