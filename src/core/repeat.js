// @ts-check
// Two-row repeats: one component in each row, in counts of two, three or four. The generator writes
// a balanced description; the rows stack with ⿱.
import { leaves, parse } from './ids.js'

/**
 * One row of `count` components, as an IDS sequence. Rows of two or three use `⿰` and `⿲`; a row
 * of four splits in half.
 * @param {string} part
 * @param {number} count
 * @returns {string}
 */
function row(part, count) {
  if (count === 2) return `⿰${part}${part}`
  if (count === 3) return `⿲${part}${part}${part}`
  return `⿰⿰${part}${part}⿰${part}${part}`
}

/**
 * Two rows of repeated components, as an IDS sequence: `rows[0]` copies of `part` above `rows[1]`
 * copies of `bottom`. The 2+3 sequence is `⿱⿰口口⿲口口口`.
 * @param {string} part A component, with an optional variation selector.
 * @param {[number, number]} rows How many copies in the top and bottom rows, each 2 to 4.
 * @param {{ bottom?: string }} [options] The bottom row's component; `part` when omitted.
 * @returns {string}
 */
export function repeatSequence(part, rows, { bottom = part } = {}) {
  /** @param {string} text @param {string} name */
  const read = (text, name) => {
    const textPart = String(text ?? '')
    const parsed = parse(textPart, { open: true })
    if (parsed.problem || typeof parsed.tree !== 'string' || parsed.tree !== textPart) {
      throw new TypeError(`A repeat ${name} must be one component.`)
    }
    return textPart
  }
  const top = read(part, 'part'), lower = read(bottom, 'bottom part')
  if (!Array.isArray(rows) || rows.length !== 2 || rows.some(count => !Number.isSafeInteger(count) || count < 2 || count > 4)) {
    throw new RangeError('A repeat needs two rows of two to four components.')
  }
  const sequence = `⿱${row(top, rows[0])}${row(lower, rows[1])}`
  const parsed = parse(sequence, { open: true })
  const expected = [...Array(rows[0]).fill(top), ...Array(rows[1]).fill(lower)]
  const found = parsed.tree === undefined ? [] : leaves(parsed.tree).map(leaf => leaf.char)
  if (parsed.problem || parsed.tree === undefined || found.length !== expected.length || found.some((char, i) => char !== expected[i])) {
    throw new TypeError('A repeat part cannot be repeated as one component.')
  }
  return sequence
}
