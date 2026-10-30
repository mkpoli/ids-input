// @ts-check
// Pyramids: one part in rows of 1, 2, 3, … . The sequence generator writes a balanced description;
// `pyramidRows` reads such a tree back, however its rows and stacks are grouped.
import { parse, sameTree } from './ids.js'
import { pyramidRows } from './pyramid-shape.js'
import { repeatedPart, repeatedText } from './repeat-part.js'

export { pyramidRows } from './pyramid-shape.js'

/**
 * The cells in a pyramid of `layers` rows.
 * @param {number} layers
 */
export const pyramidCount = layers => layers * (layers + 1) / 2

/** Whether `tree` still has an empty slot. @param {import('./ids.js').Part} tree @returns {boolean} */
const hasSlot = tree => tree === null || (typeof tree === 'object' && tree.parts.some(hasSlot))

/**
 * One part per cell of a pyramid of `layers` rows, as an IDS sequence. Rows of two or three use `⿰`
 * and `⿲`; longer rows split in half, and stacks of two or three use `⿱` and `⿳`, so the description
 * stays balanced. The 3-row sequence is `⿳口⿰口口⿲口口口`.
 *
 * The part is a component, any description or ⬚: `pyramidSequence('⿱众⿰众众', 2)` repeats that
 * description as `⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众`, and an empty part lays out empty slots.
 * @param {string} part A component, a description, or ⬚ for a slot.
 * @param {number} layers
 * @param {{ reverse?: boolean }} [options] Descend from `layers` cells to one.
 * @returns {string}
 */
export function pyramidSequence(part, layers, { reverse = false } = {}) {
  if (!Number.isSafeInteger(layers) || layers < 1) throw new RangeError('A pyramid needs at least one layer.')
  const cell = repeatedPart(part, 'pyramid part')
  /** @param {number} count @returns {import('./ids.js').Part} */
  const row = count => {
    if (count === 1) return cell
    if (count === 2) return { op: '⿰', parts: [cell, cell] }
    if (count === 3) return { op: '⿲', parts: [cell, cell, cell] }
    const left = Math.floor(count / 2)
    return { op: '⿰', parts: [row(left), row(count - left)] }
  }
  /** @param {number} index */
  const rowAt = index => row(reverse ? layers + 1 - index : index)
  /**
   * Rows `from` through `to`, one-based in reading order.
   * @param {number} from
   * @param {number} to
   * @returns {import('./ids.js').Part}
   */
  const stack = (from, to) => {
    if (from === to) return rowAt(from)
    if (to - from === 1) return { op: '⿱', parts: [rowAt(from), rowAt(to)] }
    if (to - from === 2) return { op: '⿳', parts: [rowAt(from), rowAt(from + 1), rowAt(to)] }
    const middle = Math.floor((from + to) / 2)
    return { op: '⿱', parts: [stack(from, middle), stack(middle + 1, to)] }
  }
  const text = repeatedText(stack(1, layers), 'pyramid')
  // A description without slots reads back as a pyramid of the same cell, which is what lets a long
  // one through the ordinary length and preview limits. A draft of slots is no pyramid to read.
  if (!hasSlot(cell)) {
    const read = parse(text, { open: true })
    const shape = read.tree === undefined ? null : pyramidRows(read.tree, { minLayers: layers })
    if (!shape || shape.layers !== layers || (layers > 1 && shape.reverse !== reverse)
      || !sameTree(/** @type {import('./ids.js').Part} */ (shape.cell), cell)) {
      throw new TypeError('A pyramid part cannot be repeated as written.')
    }
  }
  return text
}
