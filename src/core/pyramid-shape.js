// @ts-check
// The shape of a pyramid, read from a parsed or editor tree: rows of 1, 2, 3, … cells, every cell
// the same part. A cell is any description, so a pyramid of a repeated description reads back as
// well as a pyramid of one component. This module stays free of imports: `ids.js` uses it to let a
// long pyramid through the ordinary length limit, and `pyramid.js` builds on it.

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
  if (typeof a === 'string' || a === null || typeof a !== 'object') return false
  if (typeof b === 'string' || b === null || typeof b !== 'object') return false
  if (operatorOf(a) !== operatorOf(b)) return false
  const left = /** @type {{ marks?: string, note?: string }} */ (a), right = /** @type {{ marks?: string, note?: string }} */ (b)
  if ((left.marks ?? '') !== (right.marks ?? '') || (left.note ?? '') !== (right.note ?? '')) return false
  const kids = childrenOf(a), others = childrenOf(b)
  return Boolean(kids && others && kids.length === others.length && kids.every((kid, i) => samePart(kid, others[i])))
}

/** The cell counts of a pyramid, top row first. @param {number} layers @param {boolean} reverse */
const rowCounts = (layers, reverse) => Array.from({ length: layers }, (_, i) => reverse ? layers - i : i + 1)

/**
 * `node` as exactly `count` cells of `size` leaves each, added to `out`. A row groups its cells with
 * any `⿰` or `⿲` tree, so `⿰⿰口口口` is three cells as much as `⿲口口口` is.
 * @param {unknown} node @param {number} count @param {number} size @param {unknown[]} out @param {(node: unknown) => number} leaves
 * @returns {boolean}
 */
function splitCells(node, count, size, out, leaves) {
  if (count === 1) {
    if (leaves(node) !== size) return false
    out.push(node)
    return true
  }
  const op = operatorOf(node)
  if (op === undefined || !ROWS.has(op)) return false
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return false
  let used = 0
  for (const kid of kids) {
    const grown = leaves(kid)
    if (!size || grown % size !== 0) return false
    const cells = grown / size
    if (!cells || used + cells > count) return false
    if (!splitCells(kid, cells, size, out, leaves)) return false
    used += cells
  }
  return used === count
}

/**
 * `node` as rows `from` through `to`, added to `out`: a stack splits its operands at row bounds, and
 * a single row is its cells.
 * @param {unknown} node @param {number} from @param {number} to @param {number[]} counts @param {number} size
 * @param {unknown[]} out @param {(node: unknown) => number} leaves
 * @returns {boolean}
 */
function splitRows(node, from, to, counts, size, out, leaves) {
  if (from === to) return splitCells(node, counts[from], size, out, leaves)
  const op = operatorOf(node)
  if (op === undefined || !STACKS.has(op)) return false
  const kids = childrenOf(node)
  if (!kids || kids.length < 2) return false
  let at = from
  for (const kid of kids) {
    if (at > to) return false
    // Row leaves grow (or shrink) one row at a time, so an operand's leaves reach one row boundary
    // at most.
    let total = 0, end = -1
    for (let i = at; i <= to; i++) {
      total += counts[i] * size
      if (total === leaves(kid)) { end = i; break }
      if (total > leaves(kid)) break
    }
    if (end < 0) return false
    if (!splitRows(kid, at, end, counts, size, out, leaves)) return false
    at = end + 1
  }
  return at === to + 1
}

/**
 * A triangular arrangement of one repeated part, read from a tree: rows of 1, 2, 3, … of the same
 * cell, or in reverse order. Null unless it has at least `minLayers` rows. A cell is any subtree, so
 * a pyramid of a description reads back like one of a component; the cell is that subtree, and
 * `write`ing it gives the description the pyramid repeats. A row may be grouped by any `⿰` or `⿲`
 * tree, and a stack by any `⿱` or `⿳` tree, so equivalent spellings read alike. A single layer has
 * `reverse: false`.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options]
 * @returns {{ cell: unknown, layers: number, count: number, reverse: boolean } | null}
 */
export function pyramidRows(tree, { minLayers = 3 } = {}) {
  /** @type {Map<unknown, number>} */
  const counted = new Map()
  /** @param {unknown} node @returns {number} */
  const leaves = node => {
    if (typeof node === 'string') return 1
    if (!node || typeof node !== 'object') return 0
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
    for (const reverse of [false, true]) {
      /** @type {unknown[]} */
      const cells = []
      if (!splitRows(tree, 0, layers - 1, rowCounts(layers, reverse), size, cells, leaves) || cells.length !== count) continue
      if (!cells.every(cell => samePart(cell, cells[0]))) continue
      return { cell: cells[0], layers, count, reverse }
    }
  }
  return null
}
