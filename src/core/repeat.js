// @ts-check
// Repeats: one part in rows of one to four, stacked with ⿱, and four copies inside an enclosure. The
// part is a component, a description or an empty slot, and the generators write balanced
// descriptions.
import { repeatedPart, repeatedText } from './repeat-part.js'

/**
 * One row of `count` parts. Rows of three use `⿲`; a row of four splits in half.
 * @param {import('./ids.js').Part} part
 * @param {number} count
 * @returns {import('./ids.js').Part}
 */
function row(part, count) {
  if (count === 1) return part
  if (count === 2) return { op: '⿰', parts: [part, part] }
  if (count === 3) return { op: '⿲', parts: [part, part, part] }
  return { op: '⿰', parts: [{ op: '⿰', parts: [part, part] }, { op: '⿰', parts: [part, part] }] }
}

/**
 * The row counts in a text field: two or three numbers from 1 to 4, separated by whitespace, a
 * comma or a plus sign. Full-width digits and separators are accepted.
 * @param {string} text
 * @returns {number[] | null}
 */
export function parseRepeatRows(text) {
  const parts = String(text ?? '').normalize('NFKC').trim().split(/[\s,，、+·]+/u).filter(Boolean)
  if (parts.length < 2 || parts.length > 3 || !parts.every(part => /^[1-4]$/.test(part))) return null
  return parts.map(Number)
}

/**
 * Two or three rows of repeated parts, as an IDS sequence. The first rows hold `part`; the last row
 * holds `bottom`, which defaults to `part`. The 2+3 sequence is `⿱⿰口口⿲口口口`; 2·1·2 is
 * `⿳⿰口口口⿰口口`. A part may be a component, a description or ⬚, so `⿱众⿰众众` repeats as a
 * description and an empty `part` lays out empty slots.
 * @param {string} part A component, a description, or ⬚ for a slot.
 * @param {number[]} rows One to four copies per row, in two or three rows.
 * @param {{ bottom?: string }} [options] The last row's part; `part` when omitted.
 * @returns {string}
 */
export function repeatSequence(part, rows, { bottom = part } = {}) {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 3
    || rows.some(count => !Number.isSafeInteger(count) || count < 1 || count > 4)) {
    throw new RangeError('A repeat needs two or three rows of one to four parts.')
  }
  const top = repeatedPart(part, 'repeat part'), lower = repeatedPart(bottom, 'repeat bottom part')
  const sequence = rows.length === 2
    ? { op: '⿱', parts: [row(top, rows[0]), row(lower, rows[1])] }
    : { op: '⿳', parts: [row(top, rows[0]), row(top, rows[1]), row(lower, rows[2])] }
  return repeatedText(sequence, 'repeat')
}

/**
 * Four copies of `part` in a 2×2 grid inside `host`, as an IDS sequence: `⿴囗⿱⿰口口⿰口口` for 口
 * inside 囗. The host is a component, another description or ⬚.
 * @param {string} host The enclosing part.
 * @param {string} part A component, a description, or ⬚ for a slot.
 * @returns {string}
 */
export function enclosedRepeatSequence(host, part) {
  const enclosure = repeatedPart(host, 'enclosed repeat host'), inner = repeatedPart(part, 'enclosed repeat part')
  const sequence = { op: '⿴', parts: [enclosure, { op: '⿱', parts: [row(inner, 2), row(inner, 2)] }] }
  return repeatedText(sequence, 'enclosed repeat')
}
