// @ts-check
// ASCII names for the operators, so a sequence can be typed without an input method.
import { modifierLength } from './ids.js'

/**
 * The names 字統网 (zi.tools) gives the operators in its IDS search: LR ⿰, UD ⿱, LL ⿲ (left, middle,
 * right), UU ⿳ (above, middle, below), OC ⿴ (closed), OD ⿵, OU ⿶, OR ⿷ and OL ⿼ (open down, up,
 * right, left), RD ⿸, LD ⿹, RU ⿺ and LU ⿽ (where the inner part sits), XX ⿻ (overlaid), MI ⿾
 * (mirrored), RO ⿿ (rotated) and SU ㇯ (subtracted). 〾 has none.
 * Source: https://zi.tools/?secondary=ids, the `action_abbr_map` of its page script, read 2026-10-24.
 * @type {Readonly<Record<string, string>>}
 */
export const ALIASES = {
  LR: '⿰', UD: '⿱', LL: '⿲', UU: '⿳', OC: '⿴', OD: '⿵', OU: '⿶', OR: '⿷', RD: '⿸', LD: '⿹', RU: '⿺',
  XX: '⿻', OL: '⿼', LU: '⿽', MI: '⿾', RO: '⿿', SU: '㇯',
}
const ALIAS = new RegExp(Object.keys(ALIASES).join('|'), 'g')
/** `run` with the ASCII names in it written as operators. @param {string} run */
const translate = run => {
  const upper = run.toUpperCase()
  /** @param {string} name */
  const write = name => ALIASES[name]
  if (upper.length % 2 === 0 && (upper.match(/../g) ?? []).every(name => name in ALIASES)) return upper.replace(ALIAS, write)
  return run === upper ? run.replace(ALIAS, write) : run
}

/**
 * `text` with the ASCII operator names in it written as operators. A run of capitals is read in
 * pairs from the left (LLR is ⿲R); a run in any case is read when it is made of names only (lr, Ud).
 * A zi.tools modifier is copied untouched: its letters are an index or a matrix, not a name.
 * @param {string | null | undefined} text
 */
export const unalias = text => {
  const source = text ?? ''
  const run = /[A-Za-z]+/y
  let out = '', at = 0
  while (at < source.length) {
    if (source[at] === '[') {
      const length = modifierLength(source, at)
      if (length) { out += source.slice(at, at + length); at += length; continue }
    }
    run.lastIndex = at
    const match = run.exec(source)
    if (!match) { out += source[at++]; continue }
    out += translate(match[0])
    at = run.lastIndex
  }
  return out
}

/**
 * Whether `text` ends in the first letter of an ASCII operator name still being typed (the L of LR).
 * @param {string | null | undefined} text
 */
export const namingOperator = text => /(^|[^A-Za-z])[A-Za-z]$/.test(text ?? '')
  && Object.keys(ALIASES).some(name => name[0] === (text ?? '').at(-1)?.toUpperCase())
