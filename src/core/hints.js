// @ts-check
// The components that most often fill an operator's slot, for an editor to offer while a part is
// being written. The counts are generated from the bundled IDS descriptions by
// scripts/build_slot_hints.mjs; they describe corpus decompositions, not language-use frequency.
import catalog from './slot-hints.json' with { type: 'json' }
import { isNode, partAt } from './ids.js'

/** @typedef {import('./ids.js').Part} Part */
/** @typedef {import('./ids.js').Path} Path */
/** @typedef {[string, number]} Hint A component and the number of distinct characters using it there. */
/** @typedef {{ op: string, slot: number, hints: Hint[] }} SlotHints */

/** The most common components in each slot, by operator. @type {Map<string, { total: number, hints: Hint[] }[]>} */
export const SLOT_HINTS = new Map(catalog.operators.map(({ op, slots }) => [op, /** @type {{ total: number, hints: Hint[] }[]} */ (slots)]))

/** How many hints each slot holds, and where the counts come from. */
export const SLOT_HINT_METADATA = {
  top: catalog.top,
  method: catalog.method,
  sources: catalog.sources,
  statistics: catalog.statistics,
}

/**
 * The hints for one slot, or none where the operator or slot is unknown.
 * @param {string} op @param {number} slot
 * @returns {Hint[]}
 */
export function slotHints(op, slot) {
  return [...(SLOT_HINTS.get(op)?.[slot]?.hints ?? [])]
}

/**
 * The hints for the part at `path`, from the operator that places it. A node has no single
 * component to offer, and the root has no parent slot, so both give null.
 * @param {Part} tree @param {Path} path
 * @returns {SlotHints | null}
 */
export function hintsAt(tree, path) {
  if (!path.length) return null
  const parent = partAt(tree, path.slice(0, -1))
  const slot = /** @type {number} */ (path.at(-1))
  if (!isNode(parent) || slot >= parent.parts.length || isNode(parent.parts[slot])) return null
  const hints = slotHints(parent.op, slot)
  return hints.length ? { op: parent.op, slot, hints } : null
}
