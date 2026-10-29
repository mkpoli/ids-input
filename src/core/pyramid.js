// @ts-check
// Pyramids: one component in rows of 1, 2, 3, … . The sequence generator writes a balanced
// description; `pyramidRows` reads such a tree back, however its rows and stacks are grouped.
import { parse } from './ids.js'
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
 * @param {{ reverse?: boolean }} [options] Descend from `layers` components to one.
 * @returns {string}
 */
export function pyramidSequence(part, layers, { reverse = false } = {}) {
  const text = String(part ?? '')
  const read = parse(text, { open: true })
  if (read.problem || typeof read.tree !== 'string' || read.tree !== text) {
    throw new TypeError('A pyramid part must be one component.')
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
  /** @param {number} index */
  const rowAt = index => row(reverse ? layers + 1 - index : index)
  /**
   * Rows `from` through `to`, one-based in reading order.
   * @param {number} from
   * @param {number} to
   * @returns {string}
   */
  const stack = (from, to) => {
    if (from === to) return rowAt(from)
    if (to - from === 1) return `⿱${rowAt(from)}${rowAt(to)}`
    if (to - from === 2) return `⿳${rowAt(from)}${rowAt(from + 1)}${rowAt(to)}`
    const middle = Math.floor((from + to) / 2)
    return `⿱${stack(from, middle)}${stack(middle + 1, to)}`
  }
  const sequence = stack(1, layers)
  const parsed = parse(sequence, { open: true })
  const shape = parsed.tree === undefined ? null : pyramidRows(parsed.tree, { minLayers: layers })
  if (!shape || shape.layers !== layers || shape.part !== part) {
    throw new TypeError('A pyramid part cannot be repeated as one component.')
  }
  return sequence
}
