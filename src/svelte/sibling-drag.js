import { isNode, partAt } from '../core/ids.js'
// A private drag type keeps moves within the editor separate from text copied from a palette.
export const SIBLING_DRAG = 'application/x-ids-sibling'
/** @param {number[]} from @param {number[]} to */
export const siblings = (from, to) => from.length > 0 && from.length === to.length && from.at(-1) !== to.at(-1) && from.slice(0, -1).every((n, i) => n === to[i])
/** A neighboring sibling, or null at the edge. @param {import('../core/ids.js').Part} tree @param {number[]} path @param {number} step */
export function neighbor(tree, path, step) {
  if (!path.length) return null
  const parent = partAt(tree, path.slice(0, -1)), index = path[path.length - 1] + step
  return isNode(parent) && index >= 0 && index < parent.parts.length ? [...path.slice(0, -1), index] : null
}
/** Follow a path as siblings move, including paths below a moved subtree. @param {number[]} path @param {number[]} from @param {number[]} to */
export function remapSiblingPath(path, from, to) {
  const depth = from.length - 1
  if (!siblings(from, to) || path.length <= depth || from.slice(0, depth).some((n, i) => path[i] !== n)) return path
  const start = from[depth], end = to[depth], current = path[depth]
  const index = current === start ? end : start < end && current > start && current <= end ? current - 1 : start > end && current >= end && current < start ? current + 1 : current
  return [...path.slice(0, depth), index, ...path.slice(depth + 1)]
}
