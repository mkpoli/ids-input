// @ts-check
import { unicodeProperty } from './unicode.js'
export { UNICODE_VERSION } from './unicode.js'
// Ideographic description sequences: reading, writing and editing them as trees.
//
// Each operator takes its own number of descriptions. A component is a graphic Unicode code
// point or a private-use character, with an optional variation selector. ？ names an unknown part.
// Operators, draft slots and invisible characters cannot be components.

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

/** The longest description, in code points. */
export const LONGEST = 64
// Component acceptance follows Unicode categories, independently of preview font coverage.
// Unicode IDS operands: https://www.unicode.org/versions/Unicode18.0.0/core-spec/chapter-18/
// Letters, numbers, marks, punctuation and symbols extend those operands for mixed-script work.
/** The part no character names. */
export const UNKNOWN = '？'
/** A slot still to fill, as the editor writes it (U+2B1A DOTTED SQUARE). It is never a component, so a draft holding one never passes as whole. */
export const EMPTY = '⬚'
/** The marks an editor reads as a slot still to fill: ⬚, and ＋ as drafts and links written before ⬚ have it. */
export const EMPTY_MARKS = [EMPTY, '＋']

/** @param {string | undefined} char */
export const isSelector = char => char !== undefined && /^[︀-️\u{E0100}-\u{E01EF}]$/u.test(char)

/** Whether `char` may stand as a component. @param {string | undefined | null} char */
export const isComponent = char => {
  const first = char && String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)))
  // The bundled CHISE/Kaiyuan Small Seal allocation predates runtime Unicode support.
  return Boolean(first && (unicodeProperty('graphic', first) || /^[\u{3D000}-\u{3FC3F}]$/u.test(first))
    && !ARITY.has(first) && !EMPTY_MARKS.includes(first))
}

/** Whether `char` is an alphabetic/syllabic letter or decimal digit. @param {string | undefined | null} char */
export const isLetter = char => {
  const first = char && String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)))
  return Boolean(first && isComponent(first) && unicodeProperty('letters', first))
}

/** How many descriptions an operator takes; 0 for anything else. @param {string | undefined} char */
export const arity = char => (char === undefined ? 0 : ARITY.get(char) ?? 0)

/** A zi.tools entry's unique separator, {曰} or {?0丗}: the abstract shape its description draws,
 * with a question mark and digit where the source variant differs, and a source letter after the
 * character. @type {RegExp} */
const SEPARATOR = /^\{(?:\?[0-9]?)?([^}]+)\}/u
/** A zi.tools entry's glyph-variant definition, (.,T) or (d), after its description. @type {RegExp} */
const DEFINITION = /\([0-9A-Za-z.,]+\)$/u
/** Whether `note` names variants, as a glyph-variant definition does: letters, digits, dots, commas.
 * @param {string} note */
const isVariantList = note => /^[0-9A-Za-z.,]*$/u.test(note)
/** Whether `char` may name a shape in a unique separator: an ideograph, a CJK stroke or a curve,
 * as the zi.tools grammar has it. @param {string | undefined} char */
const isIdeograph = char => typeof char === 'string' && (unicodeProperty('ideographic', char) || /^[\u31C0-\u31E3◝◞◟◜ユス]$/u.test(char))

/**
 * The description a zi.tools entry carries, and where it starts in the entry. Its unique separator
 * {士} and its glyph-variant definition (.,T) note which glyph the description is for, not how it
 * is built; this package draws one glyph per description and keeps no variant data, so the
 * description is what remains. Anything else stays in the text, to be read or rejected as usual.
 * @param {string | null | undefined} text @returns {{ text: string, start: number }}
 */
export function entryBody(text) {
  let body = text ?? '', start = 0
  if (body.startsWith('{')) {
    const separator = SEPARATOR.exec(body)
    const name = separator ? [...separator[1]] : []
    const rest = separator ? body.slice(separator[0].length) : ''
    // {?0丗} names a character, with its variant and source after it; nothing else follows a brace.
    // The name is an ideograph: {22} counts the strokes of a part in other IDS tables, and a letter
    // or digit names no shape. A separator alone names nothing to read.
    if (separator && rest && isIdeograph(name[0]) && isVariantList(name.slice(1).join(''))) {
      start = separator[0].length
      body = rest
    }
  }
  if (body.endsWith(')')) {
    const definition = DEFINITION.exec(body)
    const prefix = definition ? body.slice(0, -definition[0].length) : ''
    const chars = [...prefix]
    // Only a complete description takes a definition: (d) after ⿲ is its third component, not a note.
    if (definition && prefix && arity(chars[0]) > 0 && descriptionEnd(chars) === chars.length) body = prefix
  }
  return { text: body, start }
}

/** The description a zi.tools entry carries, without its notes; see `entryBody`.
 * @param {string | null | undefined} text @returns {string} */
export const entryDescription = text => entryBody(text).text

/** Whether `text` starts with an operator, where a zi.tools entry starts after its separator.
 * @param {string | null | undefined} text */
export const isSequence = text => arity([...(entryDescription(text))][0]) > 0

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
 * ？ stays the component it is.
 *
 * A zi.tools entry reads as its description: the unique separator before it and the glyph-variant
 * definition after it are left out (see `entryDescription`).
 *
 * @param {string | null | undefined} text
 * @param {{ open?: boolean }} [options]
 * @returns {{ tree: Part, problem?: undefined } | { problem: Problem, tree?: undefined }}
 */
export function parse(text, { open = false } = {}) {
  const body = entryDescription(text)
  const chars = [...body]
  if (open && !chars.length) return { tree: null }
  if (!chars.length || chars.length > LONGEST || (!open && !isSequence(text)) || /[\p{Cc}\p{Cf}\p{Z}]/u.test(body)) return { problem: 'character' }
  let at = 0
  /** @returns {Part} */
  const read = () => {
    const char = chars[at++]
    if (char === undefined) { if (open) return null; throw 'missing' }
    const n = arity(char)
    if (!n) {
      if (open && EMPTY_MARKS.includes(char)) return null
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

/** A tree written back as a description, an empty slot as ⬚. @param {Part} tree @returns {string} */
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
  return replaceAt(tree, parentPath, { op: parent.op, parts })
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
  return replaceAt(tree, path, node.parts.find(part => part !== null) ?? null)
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
  return { tree: replaceAt(tree, path, { op, parts }) }
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
    if (tree !== null && ENCLOSURES.has(op)) return { tree: { op, parts: [null, tree] }, chosen: [0] }
    return { tree: wrap(op, tree), chosen: arity(op) > 1 ? [1] : [] }
  }
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
