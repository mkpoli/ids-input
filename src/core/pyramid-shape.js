// @ts-check
// The shape of a pyramid, read from a parsed or editor tree. This module stays free of imports:
// `ids.js` uses it to let a long pyramid through the ordinary length limit, and `pyramid.js` builds
// on it.

/** A slot still to fill, as the editor writes it. */
const EMPTY = '⬚'

/** The children of a parsed or editor tree node, or null for a leaf. @param {unknown} node */
const childrenOf = node => Array.isArray(node) ? node.slice(1) : node && typeof node === 'object' ? /** @type {{ parts?: unknown[] }} */ (node).parts : null
/** A node's operator, or undefined for a leaf. @param {unknown} node */
const operatorOf = node => Array.isArray(node) ? node[0] : node && typeof node === 'object' ? /** @type {{ op?: string }} */ (node).op : undefined

/** The leaves under a node, counted without building rows. @param {unknown} node */
function leafCount(node) {
  if (typeof node === 'string') return node ? 1 : 0
  const kids = childrenOf(node)
  return Array.isArray(kids) ? kids.reduce((total, kid) => total + leafCount(kid), 0) : 0
}

/**
 * A tree's rows, each an array of leaf components, or null when its operators do not divide into
 * rows. A horizontal operator joins rows that are already single rows; a vertical one stacks rows.
 * @param {unknown} node
 * @returns {string[][] | null}
 */
function rowsOf(node) {
  if (typeof node === 'string') return [[node]]
  const kids = childrenOf(node)
  if (!kids) return null
  const op = operatorOf(node)
  if (op === '⿰' || op === '⿲') {
    const row = []
    for (const child of kids) {
      const rows = rowsOf(child)
      if (!rows || rows.length !== 1) return null
      row.push(...rows[0])
    }
    return [row]
  }
  if (op === '⿱' || op === '⿳') {
    const rows = []
    for (const child of kids) {
      const found = rowsOf(child)
      if (!found) return null
      rows.push(...found)
    }
    return rows
  }
  return null
}

/**
 * A triangular arrangement of one repeated component, read from a tree: rows of 1, 2, 3, … of the
 * same component. Null unless it has at least `minLayers` rows. A row may be grouped by any `⿰` or
 * `⿲` tree, and a stack by any `⿱` or `⿳` tree, so the equivalent spellings of a pyramid all read
 * alike.
 * @param {unknown} tree
 * @param {{ minLayers?: number }} [options]
 * @returns {{ part: string, layers: number, count: number } | null}
 */
export function pyramidRows(tree, { minLayers = 3 } = {}) {
  if (leafCount(tree) < minLayers * (minLayers + 1) / 2) return null
  const rows = rowsOf(tree)
  if (!rows || rows.length < minLayers) return null
  const part = rows[0][0]
  if (typeof part !== 'string' || !part || part.startsWith(EMPTY)) return null
  for (let row = 0; row < rows.length; row++) {
    if (rows[row].length !== row + 1 || rows[row].some(cell => cell !== part)) return null
  }
  return { part, layers: rows.length, count: rows.length * (rows.length + 1) / 2 }
}
