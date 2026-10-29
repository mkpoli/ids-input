// @ts-check
// Repeats: one component in rows of one to four, stacked with ⿱, and four copies inside an
// enclosure. The generators write balanced descriptions.
import { leaves, parse } from './ids.js'

/**
 * A component's text, or a TypeError naming the part.
 * @param {string} text
 * @param {string} name
 * @returns {string}
 */
function component(text, name) {
  const written = String(text ?? '')
  const parsed = parse(written, { open: true })
  if (parsed.problem || typeof parsed.tree !== 'string' || parsed.tree !== written) {
    throw new TypeError(`A repeat ${name} must be one component.`)
  }
  return written
}

/**
 * One row of `count` components, as an IDS sequence. Rows of three use `⿲`; a row of four splits in
 * half.
 * @param {string} part
 * @param {number} count
 * @returns {string}
 */
function row(part, count) {
  if (count === 1) return part
  if (count === 2) return `⿰${part}${part}`
  if (count === 3) return `⿲${part}${part}${part}`
  return `⿰⿰${part}${part}⿰${part}${part}`
}

/**
 * The parsed sequence, when its leaves are exactly the expected components in order. Repetition can
 * join neighbours, as two regional indicators make one flag; that is not a repeat.
 * @param {string} sequence
 * @param {string[]} expected
 * @returns {string}
 */
function checked(sequence, expected) {
  const parsed = parse(sequence, { open: true })
  const found = parsed.tree === undefined ? [] : leaves(parsed.tree).map(leaf => leaf.char)
  if (parsed.problem || parsed.tree === undefined || found.length !== expected.length || found.some((char, i) => char !== expected[i])) {
    throw new TypeError('A repeat part cannot be repeated as one component.')
  }
  return sequence
}

/**
 * Two or three rows of repeated components, as an IDS sequence. The first rows hold `part`; the
 * last row holds `bottom`, which defaults to `part`. The 2+3 sequence is `⿱⿰口口⿲口口口`;
 * 2·1·2 is `⿳⿰口口口⿰口口`.
 * @param {string} part A component, with an optional variation selector.
 * @param {number[]} rows One to four copies per row, in two or three rows.
 * @param {{ bottom?: string }} [options] The last row's component; `part` when omitted.
 * @returns {string}
 */
export function repeatSequence(part, rows, { bottom = part } = {}) {
  const top = component(part, 'part'), lower = component(bottom, 'bottom part')
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 3
    || rows.some(count => !Number.isSafeInteger(count) || count < 1 || count > 4)) {
    throw new RangeError('A repeat needs two or three rows of one to four components.')
  }
  const sequence = rows.length === 2
    ? `⿱${row(top, rows[0])}${row(lower, rows[1])}`
    : `⿳${row(top, rows[0])}${row(top, rows[1])}${row(lower, rows[2])}`
  const expected = [...Array(rows[0] + (rows.length === 3 ? rows[1] : 0)).fill(top), ...Array(rows.at(-1)).fill(lower)]
  return checked(sequence, expected)
}

/**
 * Four copies of `part` in a 2×2 grid inside `host`, as an IDS sequence: `⿴囗⿱⿰口口⿰口口` for 口
 * inside 囗.
 * @param {string} host The enclosing component.
 * @param {string} part A component, with an optional variation selector.
 * @returns {string}
 */
export function enclosedRepeatSequence(host, part) {
  const enclosure = component(host, 'host'), inner = component(part, 'part')
  const sequence = `⿴${enclosure}⿱${row(inner, 2)}${row(inner, 2)}`
  return checked(sequence, [enclosure, ...Array(4).fill(inner)])
}
