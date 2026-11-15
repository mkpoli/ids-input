// @ts-check
// The skeleton of a description: its operators with every component read as one slot, and nesting
// along one axis flattened. ⿱⿱甲乙丙, ⿱甲⿱乙丙 and ⿳甲乙丙 stack three parts and share a skeleton,
// as ⿰⿰, ⿰…⿰ and ⿲ set three side by side; two rows of two and two columns of two are one grid.
// The skeleton says how parts are grouped, not how much room each takes.
import { isNode } from './ids.js'

/** @param {string} op @returns {'H' | 'V' | null} The axis an operator lays its parts along. */
const axis = op => op === '⿰' || op === '⿲' ? 'H' : op === '⿱' || op === '⿳' ? 'V' : null

/**
 * @param {import('./ids.js').Part} tree
 * @returns {string} `_` for a component, `H(…)` and `V(…)` for parts side by side and stacked,
 * `GRID2x2` for the two-by-two grid, else the operator with its parts.
 */
export function structureSkeleton(tree) {
  if (!isNode(tree)) return '_'
  const direction = axis(tree.op)
  /** @type {string[]} */
  const children = []
  /** @param {import('./ids.js').Part} child */
  const add = child => {
    if (direction && isNode(child) && axis(child.op) === direction) child.parts.forEach(add)
    else children.push(structureSkeleton(child))
  }
  tree.parts.forEach(add)
  if (direction === 'H' && children.join('') === 'V(_,_)V(_,_)'
    || direction === 'V' && children.join('') === 'H(_,_)H(_,_)') return 'GRID2x2'
  return `${direction ?? tree.op}(${children.join(',')})`
}
