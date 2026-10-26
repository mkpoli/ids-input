// @ts-check
import { isNode, partAt, replaceAt, wrap, nextEmpty } from '../core/ids.js'
import { tokens } from './tokens.js'

/** Insert beside the caret, filling an empty slot first. Axis pairs become triples;
 * other filled positions gain a local pair so existing parts are preserved.
 * @param {import('../core/ids.js').Part} tree @param {string} draft @param {number} offset
 * @param {import('../core/ids.js').Part} part @param {string} [operator]
 * @returns {{tree: import('../core/ids.js').Part, path: number[], operator?: boolean}}
 */
export function insertAt(tree, draft, offset, part, operator) {
  const spans = tokens(draft)
  const token = spans.find(token => token.start === offset)
    ?? spans.find(token => token.start < offset && token.tokenEnd >= offset)
    ?? spans.at(-1)
  const path = token?.path ?? []
  const before = !token || offset <= token.start
  const current = partAt(tree, path) ?? null
  if (operator && !before && current !== null) {
    const next = insertAt(tree, draft, offset, wrap(operator, null))
    return { tree: next.tree, path: nextEmpty(next.tree, next.path) ?? next.path, operator: true }
  }
  if (operator) {
    const next = replaceAt(tree, path, wrap(operator, current))
    return { tree: next, path: nextEmpty(next, path) ?? path, operator: true }
  }
  if (current === null) return { tree: replaceAt(tree, path, part), path }
  const parentPath = path.slice(0, -1), parent = path.length ? partAt(tree, parentPath) : null
  const index = path.at(-1) ?? 0
  if (isNode(parent) && (parent.op === '⿰' || parent.op === '⿱')) {
    const parts = [...parent.parts], at = index + (before ? 0 : 1)
    parts.splice(at, 0, part)
    return { tree: replaceAt(tree, parentPath, { op: parent.op === '⿰' ? '⿲' : '⿳', parts }), path: [...parentPath, at] }
  }
  const op = isNode(parent) && parent.op === '⿳' ? '⿱' : '⿰'
  return { tree: replaceAt(tree, path, { op, parts: before ? [part, current] : [current, part] }), path: [...path, before ? 0 : 1] }
}
