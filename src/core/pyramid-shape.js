// @ts-check
// The shape of a pyramid, read from a parsed or editor tree: groups of 1, 2, 3, … cells pointing
// top, bottom, left or right, every cell the same part. A cell is any description, so a pyramid of
// a repeated description reads back as well as a pyramid of one component. This module imports
// nothing at runtime: `ids.js` uses it to let a long pyramid through the ordinary length limit, and
// `pyramid.js` builds on it.

/** @typedef {import('./ids.js').Part} Part */

/** The four ways a pyramid can point. */
export const PYRAMID_DIRECTIONS = /** @type {('top' | 'bottom' | 'left' | 'right')[]} */ (['top', 'bottom', 'left', 'right'])

/** The cell an empty slot writes, numbered or not. */
const EMPTY = '⬚'
/** Whether `node` is an empty slot. A drawing numbers them (`⬚0`, `⬚1`, …). @param {unknown} node */
const isSlot = node => typeof node === 'string' && node[0] === EMPTY

/** The children of a parsed or editor tree node, or null for a leaf. @param {unknown} node */
const childrenOf = node => Array.isArray(node) ? node.slice(1) : node && typeof node === 'object' ? /** @type {{ parts?: unknown[] }} */ (node).parts : null
/** A node's operator, or undefined for a leaf. @param {unknown} node */
const operatorOf = node => Array.isArray(node) ? node[0] : node && typeof node === 'object' ? /** @type {{ op?: string }} */ (node).op : undefined
/** Operators whose operands share a row. */
const ROWS = new Set(['⿰', '⿲'])
/** Operators whose operands stack. */
const STACKS = new Set(['⿱', '⿳'])

/**
 * Whether two cells are the same part, marks and modifiers included. Both cells come from one tree,
 * so they are spelled the same way (parsed arrays or editor nodes).
 * @param {unknown} a @param {unknown} b
 * @returns {boolean}
 */
function samePart(a, b) {
  if (a === b) return true
  // One empty slot is the cell of a pyramid of empty slots wherever it sits and however numbered.
  if (isSlot(a) && isSlot(b)) return true
  if (typeof a === 'string' || a === null || typeof a !== 'object') return false
  if (typeof b === 'string' || b === null || typeof b !== 'object') return false
  if (operatorOf(a) !== operatorOf(b)) return false
  const left = /** @type {{ marks?: string, note?: string }} */ (a), right = /** @type {{ marks?: string, note?: string }} */ (b)
  if ((left.marks ?? '') !== (right.marks ?? '') || (left.note ?? '') !== (right.note ?? '')) return false
  const kids = childrenOf(a), others = childrenOf(b)
  return Boolean(kids && others && kids.length === others.length && kids.every((kid, i) => samePart(kid, others[i])))
}

/** The group counts, first group first. @param {number} layers @param {'top' | 'bottom' | 'left' | 'right'} direction */
const groupCounts = (layers, direction) => Array.from({ length: layers }, (_, i) => direction === 'bottom' || direction === 'right' ? layers - i : i + 1)

/**
 * `node` as exactly `count` cells of `size` leaves each, added to `out`. `axis` is the operator set
 * the cells are grouped with: `⿰`/`⿲` along a row, `⿱`/`⿳` down a column. Any grouping with that
 * axis works, so `⿰⿰口口口` is three cells as much as `⿲口口口` is.
 * @param {unknown} node @param {number} count @param {number} size @param {unknown[]} out
 * @param {(node: unknown) => number} leaves @param {Set<string>} axis
 * @returns {boolean}
 */
function splitCells(node, count, size, out, leaves, axis) {
  if (count === 1) {
    if (leaves(node) !== size) return false
    out.push(node)
    return true
  }
  const op = operatorOf(node)
  if (op === undefined || !axis.has(op)) return false
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return false
  let used = 0
  for (const kid of kids) {
    const grown = leaves(kid)
    if (!size || grown % size !== 0) return false
    const cells = grown / size
    if (!cells || used + cells > count) return false
    if (!splitCells(kid, cells, size, out, leaves, axis)) return false
    used += cells
  }
  return used === count
}

/**
 * `node` as groups `from` through `to`, added to `out`: an operator on the arrangement axis splits
 * its operands at group bounds, and a single group is its cells on the other axis.
 * @param {unknown} node @param {number} from @param {number} to @param {number[]} counts @param {number} size
 * @param {unknown[]} out @param {(node: unknown) => number} leaves @param {Set<string>} outer @param {Set<string>} inner
 * @returns {boolean}
 */
function splitGroups(node, from, to, counts, size, out, leaves, outer, inner) {
  if (from === to) return splitCells(node, counts[from], size, out, leaves, inner)
  const op = operatorOf(node)
  if (op === undefined || !outer.has(op)) return false
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return false
  let at = from
  for (const kid of kids) {
    if (at > to) return false
    // Group leaves grow (or shrink) one group at a time, so an operand's leaves reach one group
    // boundary at most.
    let total = 0, end = -1
    for (let i = at; i <= to; i++) {
      total += counts[i] * size
      if (total === leaves(kid)) { end = i; break }
      if (total > leaves(kid)) break
    }
    if (end < 0) return false
    if (!splitGroups(kid, at, end, counts, size, out, leaves, outer, inner)) return false
    at = end + 1
  }
  return at === to + 1
}

/**
 * A triangular arrangement of one repeated part, read from a tree: groups of 1, 2, 3, … of the same
 * cell, pointing top, bottom, left or right. Null unless it has at least `minLayers` layers. A cell
 * is any subtree, so a pyramid of a description reads back like one of a component; the cell is that
 * subtree, and `write`ing it gives the description the pyramid repeats. A row may be grouped by any
 * `⿰` or `⿲` tree, and a stack by any `⿱` or `⿳` tree, so equivalent spellings read alike. A single
 * layer points `top`.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options]
 * @returns {{ cell: Part, layers: number, count: number, direction: 'top' | 'bottom' | 'left' | 'right' } | null}
 */
export function pyramidRows(tree, { minLayers = 3 } = {}) {
  /** @type {Map<unknown, number>} */
  const counted = new Map()
  /** @param {unknown} node @returns {number} */
  const leaves = node => {
    if (typeof node === 'string' || node === null) return 1
    if (typeof node !== 'object') return 0
    const known = counted.get(node)
    if (known !== undefined) return known
    const kids = childrenOf(node)
    const total = kids ? kids.reduce((sum, kid) => sum + leaves(kid), 0) : 0
    counted.set(node, total)
    return total
  }
  const total = leaves(tree)
  if (!(minLayers >= 1) || total < minLayers * (minLayers + 1) / 2) return null
  // The most rows the leaves allow: every cell holds at least one leaf.
  const most = Math.floor((Math.sqrt(8 * total + 1) - 1) / 2)
  for (let layers = most; layers >= minLayers; layers--) {
    const count = layers * (layers + 1) / 2
    if (total % count) continue
    const size = total / count
    for (const direction of PYRAMID_DIRECTIONS) {
      // Rows are cells grouped along `⿰`/`⿲` inside a stack; columns are cells grouped down
      // `⿱`/`⿳` inside a row.
      const sideways = direction === 'left' || direction === 'right'
      const outer = sideways ? ROWS : STACKS
      const inner = sideways ? STACKS : ROWS
      /** @type {unknown[]} */
      const cells = []
      if (!splitGroups(tree, 0, layers - 1, groupCounts(layers, direction), size, cells, leaves, outer, inner) || cells.length !== count) continue
      if (!cells.every(cell => samePart(cell, cells[0]))) continue
      return { cell: /** @type {Part} */ (cells[0]), layers, count, direction }
    }
  }
  return null
}
