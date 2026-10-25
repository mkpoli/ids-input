// @ts-check
// Ideographic description sequences: reading, writing and editing them as trees.
//
// Each operator takes its own number of descriptions. A component is an ideograph, a radical, a
// stroke, a katakana letter standing for a component of that shape (コ, マ), a private-use character
// or ？ for a part no character names, with an optional variation selector.

/**
 * @typedef {string} Component A component's text, with its variation selector if it has one.
 * @typedef {{ op: string, parts: Part[] }} Node An operator with its parts.
 * @typedef {Component | Node | null} Part A part of a tree; null is a slot still to fill.
 * @typedef {number[]} Path The part indices from the root down to a part.
 * @typedef {'component' | 'missing' | 'extra' | 'character'} Problem
 */

/** @type {ReadonlyArray<readonly [string, number]>} The operators, each with how many descriptions it takes, in keyboard order. */
export const OPERATORS = [
  ['⿰', 2], ['⿱', 2], ['⿲', 3], ['⿳', 3], ['⿴', 2], ['⿵', 2], ['⿶', 2], ['⿷', 2], ['⿸', 2], ['⿹', 2],
  ['⿺', 2], ['⿻', 2], ['⿼', 2], ['⿽', 2], ['⿾', 1], ['⿿', 1], ['㇯', 2], ['〾', 1],
]
const ARITY = new Map(OPERATORS)

/** The longest description, in code points. */
export const LONGEST = 64
const COMPONENTS = [[0x2E80, 0x2FDF], [0x30A1, 0x30FA], [0x31C0, 0x31EE], [0x3400, 0x4DBF], [0x4E00, 0x9FFF],
  [0xE000, 0xF8FF], [0xF900, 0xFAFF], [0xFF1F, 0xFF1F], [0x20000, 0x3FFFD], [0xF0000, 0x10FFFD]]
/** The part no character names. */
export const UNKNOWN = '？'
/** A slot still to fill, as the editor writes it. It is never a component, so a draft holding one never passes as whole. */
export const EMPTY = '＋'

/** @param {string | undefined} char */
export const isSelector = char => char !== undefined && /^[︀-️\u{E0100}-\u{E01EF}]$/u.test(char)

/** Whether `char` may stand as a component. @param {string | undefined | null} char */
export const isComponent = char => {
  const point = char?.codePointAt(0)
  return point !== undefined && COMPONENTS.some(([low, high]) => point >= low && point <= high)
}

/** How many descriptions an operator takes; 0 for anything else. @param {string | undefined} char */
export const arity = char => (char === undefined ? 0 : ARITY.get(char) ?? 0)

/** Whether `text` starts with an operator. @param {string | null | undefined} text */
export const isSequence = text => arity([...(text ?? '')][0]) > 0

/**
 * A description as a tree. Answers `{ tree }`, or `{ problem }` naming what is wrong: `component`
 * (a part no description may name), `missing` (an operator short of descriptions), `extra` (more
 * than its operators take) or `character` (empty, too long, a space or control character, or no
 * operator first).
 *
 * With `open`, as an editor reads a draft, a slot still to fill is `null`: ＋ and every part an
 * operator is still missing at the end read as one, an empty text is the empty tree, and a lone
 * component stands as a tree of its own (⿰亻 is ⿰亻 and an empty slot, ⿰＋木 an empty slot and 木).
 * ？ stays the component it is.
 *
 * @param {string | null | undefined} text
 * @param {{ open?: boolean }} [options]
 * @returns {{ tree: Part, problem?: undefined } | { problem: Problem, tree?: undefined }}
 */
export function parse(text, { open = false } = {}) {
  const chars = [...(text ?? '')]
  if (open && !chars.length) return { tree: null }
  if (!chars.length || chars.length > LONGEST || (!open && !isSequence(text)) || /[\p{Cc}\p{Cf}\p{Z}]/u.test(text ?? '')) return { problem: 'character' }
  let at = 0
  /** @returns {Part} */
  const read = () => {
    const char = chars[at++]
    if (char === undefined) { if (open) return null; throw 'missing' }
    const n = arity(char)
    if (!n) {
      if (open && char === EMPTY) return null
      if (!isComponent(char)) throw 'component'
      return isSelector(chars[at]) ? char + chars[at++] : char
    }
    return { op: char, parts: Array.from({ length: n }, read) }
  }
  try {
    const tree = read()
    return at < chars.length ? { problem: 'extra' } : { tree }
  } catch (problem) { return { problem: /** @type {Problem} */ (problem) } }
}

/** Whether `text` is one well-formed description. @param {string | null | undefined} text */
export const isDescription = text => isSequence(text) && !parse(text).problem

/**
 * What is wrong with `text` as a whole description, or null when nothing is.
 * @param {string | null | undefined} text
 * @returns {Problem | null}
 */
export const problemOf = text => parse(text).problem ?? null

/**
 * Where the description starting at `chars[at]` ends, or -1 when none well-formed starts there. A
 * text may run on past it (⿰亻哥 in ⿰亻哥と).
 * @param {string[]} chars
 * @param {number} [at]
 * @returns {number}
 */
export function descriptionEnd(chars, at = 0) {
  const char = chars[at]
  if (char === undefined) return -1
  const n = arity(char)
  if (!n) return isComponent(char) ? (isSelector(chars[at + 1]) ? at + 2 : at + 1) : -1
  let end = at + 1
  for (let k = 0; k < n && end >= 0; k++) end = descriptionEnd(chars, end)
  return end
}

/** Whether `part` is a node. @param {Part | undefined} part @returns {part is Node} */
export const isNode = part => part !== null && typeof part === 'object'

/** A tree written back as a description, an empty slot as ＋. @param {Part} tree @returns {string} */
export const write = tree => tree === null ? EMPTY : isNode(tree) ? tree.op + tree.parts.map(write).join('') : tree

/**
 * Every component of a tree with its path, in reading order; an empty slot has the `char` null.
 * @param {Part} tree
 * @param {Path} [path]
 * @returns {{ path: Path, char: Component | null }[]}
 */
export function leaves(tree, path = []) {
  return isNode(tree) ? tree.parts.flatMap((part, i) => leaves(part, [...path, i])) : [{ path, char: tree }]
}

/**
 * The path of every part of a tree, nodes and slots, the root first, in reading order: the order
 * Tab steps through them.
 * @param {Part} tree
 * @param {Path} [path]
 * @returns {Path[]}
 */
export function paths(tree, path = []) {
  return [path, ...(isNode(tree) ? tree.parts.flatMap((part, i) => paths(part, [...path, i])) : [])]
}

/** Whether two paths name the same part. @param {Path | null | undefined} a @param {Path | null | undefined} b */
export const samePath = (a, b) => Boolean(a && b) && a?.length === b?.length && (a ?? []).every((x, i) => x === b?.[i])

/**
 * The part at `path`, undefined where the tree has none.
 * @param {Part} tree
 * @param {Path} path
 * @returns {Part | undefined}
 */
export const partAt = (tree, path) => path.reduce(
  /** @param {Part | undefined} node */ (node, i) => isNode(node) ? node.parts[i] : undefined, /** @type {Part | undefined} */ (tree))

/**
 * The first empty slot after `from` in reading order, coming round to the start; the first of all
 * without `from`. Null when every slot is filled.
 * @param {Part} tree
 * @param {Path | null} [from]
 * @returns {Path | null}
 */
export function nextEmpty(tree, from = null) {
  const all = paths(tree), at = from ? all.findIndex(path => samePath(path, from)) : -1
  for (let k = 1; k <= all.length; k++) {
    const path = all[(at + k) % all.length]
    if (partAt(tree, path) === null) return path
  }
  return null
}

/**
 * `tree` with the part at `path` replaced by `part`.
 * @param {Part} tree
 * @param {Path} path
 * @param {Part} part
 * @returns {Part}
 */
export function replaceAt(tree, path, part) {
  if (!path.length) return part
  if (!isNode(tree)) return tree
  const [head, ...rest] = path
  return { op: tree.op, parts: tree.parts.map((p, i) => i === head ? replaceAt(p, rest, part) : p) }
}

/**
 * `part` under `op`: the part first and an empty slot for every other part the operator takes, so a
 * component can be split in place (⿰ round 失 gives ⿰失＋).
 * @param {string} op
 * @param {Part} part
 * @returns {Node}
 */
export const wrap = (op, part) => ({ op, parts: [part, ...Array(Math.max(arity(op) - 1, 0)).fill(null)] })

/** `tree` with the part at `path` emptied. @param {Part} tree @param {Path} path */
export const clear = (tree, path) => replaceAt(tree, path, null)

/**
 * `tree` with the node at `path` taken away, one level: its first part that is not empty stands in
 * its place (⿰＋木 gives 木), or an empty slot where all are. A component is left as it is.
 * @param {Part} tree
 * @param {Path} path
 * @returns {Part}
 */
export function unwrap(tree, path) {
  const node = partAt(tree, path)
  if (!isNode(node)) return tree
  return replaceAt(tree, path, node.parts.find(part => part !== null) ?? null)
}

/**
 * `tree` with the node at `path` under the operator `op` instead, its parts kept in order. Answers
 * `{ tree }`, or `{ problem: 'drop' }` when `op` takes fewer parts and one it would drop is filled.
 * Parts it takes beyond the old ones are empty slots (⿰亻木 as ⿲ is ⿲亻木＋).
 * @param {Part} tree
 * @param {Path} path
 * @param {string} op
 * @returns {{ tree: Part, problem?: undefined } | { problem: 'drop', tree?: undefined }}
 */
export function swapOp(tree, path, op) {
  const node = partAt(tree, path), n = arity(op)
  if (!isNode(node) || !n) return { tree }
  if (node.parts.slice(n).some(part => part !== null)) return { problem: 'drop' }
  const parts = Array.from({ length: n }, (_, i) => node.parts[i] ?? null)
  return { tree: replaceAt(tree, path, { op, parts }) }
}

/**
 * Where an operator goes in a draft, and what the tree becomes. On a node it swaps the operator; on
 * a slot or a component it splits it, the old part first. With no target (every slot filled and none
 * chosen) the whole tree becomes the operator's first part. Answers the new tree and the part to
 * choose next, or `{ problem: 'drop' }`.
 * @param {Part} tree
 * @param {Path | null} at
 * @param {string} op
 * @returns {{ tree: Part, chosen: Path, problem?: undefined } | { problem: 'drop', tree?: undefined, chosen?: undefined }}
 */
export function applyOperator(tree, at, op) {
  if (!at) return { tree: wrap(op, tree), chosen: arity(op) > 1 ? [1] : [] }
  const part = partAt(tree, at)
  if (isNode(part)) {
    const swapped = swapOp(tree, at, op)
    return swapped.problem ? swapped : { tree: swapped.tree, chosen: at }
  }
  // The old part stays first; the slot to fill next is the new one beside it, or the operator's only
  // one when the slot was empty.
  const chosen = part === null ? [...at, 0] : arity(op) === 1 ? at : [...at, 1]
  return { tree: replaceAt(tree, at, wrap(op, part ?? null)), chosen }
}

/**
 * `part` put at `at`, and the slot to choose next: the next empty one, else `at` again.
 * @param {Part} tree
 * @param {Path} at
 * @param {Part} part
 * @returns {{ tree: Part, chosen: Path }}
 */
export function place(tree, at, part) {
  const next = replaceAt(tree, at, part)
  return { tree: next, chosen: nextEmpty(next, at) ?? at }
}
