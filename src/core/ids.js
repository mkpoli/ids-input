// @ts-check
import { unicodeProperty } from './unicode.js'
import { isMark, normalizeMarks, marksOf, withMarks, withoutMarks } from './marks.js'
export { UNICODE_VERSION } from './unicode.js'
export * from './marks.js'
// Ideographic description sequences: reading, writing and editing them as trees.
//
// Each operator takes its own number of descriptions. A component is a graphic Unicode code
// point, a private-use character, or one of the bundled allocations below, with an optional
// variation selector. ？ names an unknown part. Operators, draft slots and invisible characters
// cannot be components. A run of loose marks (`marks.js`) after the whole description annotates it:
// ⿰亻木ˊ, ⿰ㄅㄚˇ, ⿰氵青゛.

/**
 * @typedef {string} Component A component's text, with its variation selector and any loose marks it carries.
 * @typedef {{ op: string, parts: Part[], marks?: string }} Node An operator with its parts, and the loose marks written after them.
 * @typedef {Component | Node | null} Part A part of a tree; null is a slot still to fill.
 * @typedef {number[]} Path The part indices from the root down to a part.
 * @typedef {'component' | 'missing' | 'extra' | 'character'} Problem
 */

import { pyramidRows } from './pyramid-shape.js'

/** @type {ReadonlyArray<readonly [string, number]>} The operators, each with how many descriptions it takes, in keyboard order. */
export const OPERATORS = [
  ['⿰', 2], ['⿱', 2], ['⿲', 3], ['⿳', 3], ['⿴', 2], ['⿵', 2], ['⿶', 2], ['⿷', 2], ['⿸', 2], ['⿹', 2],
  ['⿺', 2], ['⿻', 2], ['⿼', 2], ['⿽', 2], ['⿾', 1], ['⿿', 1], ['㇯', 2], ['〾', 1],
]
const ARITY = new Map(OPERATORS)
const ENCLOSURES = new Set(['⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿼', '⿽'])

/**
 * The operators grouped by how many parts they take, as a palette shows them: those that change one
 * part, those that place two (side by side, enclosing, at a corner, over or out of each other) and
 * those that place three.
 * @type {ReadonlyArray<{ arity: 1 | 2 | 3, ops: readonly string[] }>}
 */
export const OPERATOR_GROUPS = [
  { arity: 1, ops: ['⿾', '⿿', '〾'] },
  { arity: 2, ops: ['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿼', '⿸', '⿹', '⿺', '⿽', '⿻', '㇯'] },
  { arity: 3, ops: ['⿲', '⿳'] },
]

/** The longest ordinary description, in code points. */
export const LONGEST = 64
/** The longest pyramid description, in code points: 64 rows take 3,818. */
export const PYRAMID_LONGEST = 8192
/** The deepest operator nest the parser reads, so a long input cannot exhaust the call stack. */
const MAX_DEPTH = 512
// Component acceptance follows Unicode categories, independently of preview font coverage.
// Unicode IDS operands: https://www.unicode.org/versions/Unicode18.0.0/core-spec/chapter-18/
// Letters, numbers, marks, punctuation and symbols extend those operands for mixed-script work.
/** The part no character names. */
export const UNKNOWN = '？'
/** A slot still to fill, as the editor writes it (U+2B1A DOTTED SQUARE). It is never a component, so a draft holding one never passes as whole. */
export const EMPTY = '⬚'
/** The marks an editor reads as a slot still to fill: ⬚, and ＋ as drafts and links written before ⬚ have it. */
export const EMPTY_MARKS = [EMPTY, '＋']

/**
 * The four letters the New Korean Orthography added to Hangul, in the initial, final and medial
 * positions proposed in OBAYASHI Muneaki, L2/19-230R (2019-06-24). Unicode 18.0.0 leaves them
 * unassigned; the editor accepts them with the bundled outlines in `data/new-korean-outlines.json.gz`
 * and the `IDS New Korean` font, as it does for the Small Seal allocation.
 */
export const NEW_KOREAN = /[\u{A97D}-\u{A97F}\u{D7C7}\u{D7FC}-\u{D7FE}]/u
/** Whether `text` contains a New Korean Orthography letter. @param {string | null | undefined} text */
export const isNewKorean = text => NEW_KOREAN.test(text ?? '')

/** @param {string | undefined} char */
export const isSelector = char => char !== undefined && /^[︀-️\u{E0100}-\u{E01EF}]$/u.test(char)

/** Whether `char` may stand as a component. @param {string | undefined | null} char */
export const isComponent = char => {
  const first = char && String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)))
  // The bundled CHISE/Kaiyuan Small Seal allocation and the proposed New Korean Orthography
  // letters are outside Unicode's assigned set and have bundled outlines.
  return Boolean(first && (unicodeProperty('graphic', first) || /^[\u{3D000}-\u{3FC3F}]$/u.test(first) || NEW_KOREAN.test(first))
    && !ARITY.has(first) && !EMPTY_MARKS.includes(first))
}

/** Whether `char` is an alphabetic/syllabic letter or decimal digit. @param {string | undefined | null} char */
export const isLetter = char => {
  const first = char && String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)))
  return Boolean(first && isComponent(first) && (unicodeProperty('letters', first) || NEW_KOREAN.test(first)))
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
 * With `open`, as an editor reads a draft, a slot still to fill is `null`: ⬚ (or ＋, as older drafts
 * write it) and every part an
 * operator is still missing at the end read as one, an empty text is the empty tree, and a lone
 * component stands as a tree of its own (⿰亻 is ⿰亻 and an empty slot, ⿰⬚木 an empty slot and 木).
 * ？ stays the component it is. A whole text longer than `LONGEST` reads only when it is a pyramid
 * of three or more rows, up to `PYRAMID_LONGEST` code points; a draft may be that long.
 *
 * @param {string | null | undefined} text
 * @param {{ open?: boolean }} [options]
 * @returns {{ tree: Part, problem?: undefined } | { problem: Problem, tree?: undefined }}
 */
export function parse(text, { open = false } = {}) {
  const chars = [...(text ?? '')]
  if (open && !chars.length) return { tree: null }
  const long = chars.length > LONGEST
  if (!chars.length || chars.length > PYRAMID_LONGEST || (!open && !isSequence(text)) || /[\p{Cc}\p{Cf}\p{Z}]/u.test(text ?? '')) return { problem: 'character' }
  let at = 0, depth = 0
  /** @returns {Part} */
  const read = () => {
    if (depth++ >= MAX_DEPTH) throw 'character'
    try {
      const char = chars[at++]
      if (char === undefined) { if (open) return null; throw 'missing' }
      const n = arity(char)
      if (!n) {
        if (open && EMPTY_MARKS.includes(char)) return null
        if (!isComponent(char)) throw 'component'
        return isSelector(chars[at]) ? char + chars[at++] : char
      }
      return { op: char, parts: Array.from({ length: n }, read) }
    } finally { depth-- }
  }
  try {
    let tree = read()
    // Loose marks trail the whole description; where a mark fills an operand, it is that operand.
    if (at < chars.length && isMark(chars[at])) {
      let marks = ''
      while (at < chars.length && isMark(chars[at])) marks += chars[at++]
      tree = withMarks(tree, marks)
    }
    // A whole description may run past the ordinary length only as a pyramid; a draft may be long.
    if (!open && long && !pyramidRows(tree)) return { problem: 'character' }
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

/** A tree written back as a description, an empty slot as ⬚, loose marks after their part. @param {Part} tree @returns {string} */
export const write = tree => tree === null ? EMPTY : isNode(tree) ? tree.op + tree.parts.map(write).join('') + (tree.marks ?? '') : tree

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
  return { ...tree, parts: tree.parts.map((p, i) => i === head ? replaceAt(p, rest, part) : p) }
}

/** Move a part within its parent, retaining the order of the other siblings.
 * Paths must name two distinct children of the same node.
 * @param {Part} tree @param {Path} from @param {Path} to @returns {Part} */
export function reorderSiblings(tree, from, to) {
  if (!from.length || from.length !== to.length || from.at(-1) === to.at(-1) || from.slice(0, -1).some((n, i) => n !== to[i])) return tree
  const parentPath = from.slice(0, -1), parent = partAt(tree, parentPath)
  const start = from[from.length - 1], end = to[to.length - 1]
  if (!isNode(parent) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start >= parent.parts.length || end >= parent.parts.length) return tree
  const parts = [...parent.parts]
  parts.splice(end, 0, parts.splice(start, 1)[0])
  return replaceAt(tree, parentPath, { ...parent, parts })
}

/**
 * `part` under `op`: the part first and an empty slot for every other part the operator takes, so a
 * component can be split in place (⿰ round 失 gives ⿰失⬚).
 * @param {string} op
 * @param {Part} part
 * @returns {Node}
 */
export const wrap = (op, part) => ({ op, parts: [part, ...Array(Math.max(arity(op) - 1, 0)).fill(null)] })

/** `tree` with the part at `path` emptied. @param {Part} tree @param {Path} path */
export const clear = (tree, path) => replaceAt(tree, path, null)

/**
 * `tree` with the node at `path` taken away, one level: its first part that is not empty stands in
 * its place (⿰⬚木 gives 木), or an empty slot where all are. A component is left as it is.
 * @param {Part} tree
 * @param {Path} path
 * @returns {Part}
 */
export function unwrap(tree, path) {
  const node = partAt(tree, path)
  if (!isNode(node)) return tree
  const kept = node.parts.find(part => part !== null) ?? null
  return normalizeMarks(replaceAt(tree, path, withMarks(kept, node.marks ?? '')))
}

/**
 * `tree` with the node at `path` under the operator `op` instead, its parts kept in order. Answers
 * `{ tree }`, or `{ problem: 'drop' }` when `op` takes fewer parts and one it would drop is filled.
 * Parts it takes beyond the old ones are empty slots (⿰亻木 as ⿲ is ⿲亻木⬚).
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
  return { tree: normalizeMarks(replaceAt(tree, path, { op, parts, ...(node.marks ? { marks: node.marks } : {}) })) }
}

/**
 * Where an operator goes in a draft, and what the tree becomes. On a node it swaps the operator; on
 * a slot or a component it splits it, the old part first. With no target, an enclosing operator puts
 * the whole tree inside an empty frame; other operators put it first. Answers the new tree and the
 * part to choose next, or `{ problem: 'drop' }`.
 * @param {Part} tree
 * @param {Path | null} at
 * @param {string} op
 * @returns {{ tree: Part, chosen: Path, problem?: undefined } | { problem: 'drop', tree?: undefined, chosen?: undefined }}
 */
export function applyOperator(tree, at, op) {
  if (!at) {
    // Loose marks annotate the description; a new operator around it takes them with the whole.
    const marks = marksOf(tree), base = withoutMarks(tree)
    if (base !== null && ENCLOSURES.has(op)) return { tree: normalizeMarks(withMarks({ op, parts: [null, base] }, marks)), chosen: [0] }
    return { tree: normalizeMarks(withMarks(wrap(op, base), marks)), chosen: arity(op) > 1 ? [1] : [] }
  }
  const part = partAt(tree, at)
  if (isNode(part)) {
    const swapped = swapOp(tree, at, op)
    return swapped.problem ? swapped : { tree: swapped.tree, chosen: at }
  }
  // The old part stays first; the slot to fill next is the new one beside it, or the operator's only
  // one when the slot was empty.
  const chosen = part === null ? [...at, 0] : arity(op) === 1 ? at : [...at, 1]
  return { tree: normalizeMarks(replaceAt(tree, at, wrap(op, part ?? null))), chosen }
}

/**
 * `part` put at `at`, and the slot to choose next: the next empty one, else `at` again.
 * @param {Part} tree
 * @param {Path} at
 * @param {Part} part
 * @returns {{ tree: Part, chosen: Path }}
 */
export function place(tree, at, part) {
  const next = normalizeMarks(replaceAt(tree, at, part))
  return { tree: next, chosen: nextEmpty(next, at) ?? at }
}

/**
 * `text` split at its loose marks: the description without them and the marks it ends with. A text
 * that is not one description, or has none, answers itself and ''. Where a mark fills an operand
 * (⿰ㄅˊ with ⿰ short of one) it stays a component, as it reads.
 * @param {string | null | undefined} text
 * @returns {{ base: string, marks: string }}
 */
export function splitDescription(text) {
  // Most descriptions end on a component: without a mark at the end there is nothing to read.
  const chars = [...(text ?? '')]
  if (!isMark(chars[chars.length - 1])) return { base: text ?? '', marks: '' }
  const read = parse(text, { open: true })
  if (read.problem || read.tree === null) return { base: text ?? '', marks: '' }
  const marks = marksOf(read.tree)
  return marks ? { base: write(withoutMarks(read.tree)), marks } : { base: text ?? '', marks: '' }
}
