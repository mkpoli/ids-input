// @ts-check
// Pyramids: one component in rows of 1, 2, 3, … . The sequence generator writes a balanced
// description; `pyramidRows` reads such a tree back, however its rows and stacks are grouped.
import { isComponent, isSelector } from './ids.js'
import { pyramidRows } from './pyramid-shape.js'

export { pyramidRows } from './pyramid-shape.js'

/**
 * The components in a pyramid of `layers` rows.
 * @param {number} layers
 */
export const pyramidCount = layers => layers * (layers + 1) / 2

/**
 * One component per cell of a pyramid of `layers` rows, as an IDS sequence. Rows of two or three
 * use `⿰` and `⿲`; longer rows split in half, and stacks of two or three use `⿱` and `⿳`, so the
 * description stays balanced. The 3-row sequence is `⿳口⿰口口⿲口口口`.
 * @param {string} part A component, with an optional variation selector.
 * @param {number} layers
 * @returns {string}
 */
export function pyramidSequence(part, layers) {
  const chars = [...String(part ?? '')]
  if (!chars.length || chars.length > 2 || !isComponent(chars[0]) || (chars.length === 2 && !isSelector(chars[1]))) {
    throw new TypeError('A pyramid part must be one component, with an optional variation selector.')
  }
  if (!Number.isSafeInteger(layers) || layers < 1) throw new RangeError('A pyramid needs at least one layer.')
  /** @param {number} count @returns {string} */
  const row = count => {
    if (count === 1) return part
    if (count === 2) return `⿰${part}${part}`
    if (count === 3) return `⿲${part}${part}${part}`
    const left = Math.floor(count / 2)
    return `⿰${row(left)}${row(count - left)}`
  }
  /**
   * Rows `from` through `to`, one-based.
   * @param {number} from
   * @param {number} to
   * @returns {string}
   */
  const stack = (from, to) => {
    if (from === to) return row(from)
    if (to - from === 1) return `⿱${row(from)}${row(to)}`
    if (to - from === 2) return `⿳${row(from)}${row(from + 1)}${row(to)}`
    const middle = Math.floor((from + to) / 2)
    return `⿱${stack(from, middle)}${stack(middle + 1, to)}`
  }
  return stack(1, layers)
}
