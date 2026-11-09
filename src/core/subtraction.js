// @ts-check
// Subtraction as a description: ㇯SX takes X out of what S decomposes into, so ㇯軍車 is 冖 because
// 軍 is ⿱冖車. A description is read only as far as a character's own decomposition, and a node
// left with one part collapses to that part.
import { UNKNOWN, arity, isNode, parse, write } from './ids.js'

/** @typedef {import('./ids.js').Part} SubtractionPart */

/** The first operand is taken away whole. */
const GONE = Symbol('gone')

/** A part a removal can read: no placeholder, operator note or loose marks anywhere in it.
 * @param {SubtractionPart} part @returns {boolean} */
function plain(part) {
  if (part === null) return true
  if (typeof part === 'string') return part !== UNKNOWN
  return !part.note && !part.marks && part.parts.every(child => plain(child))
}

/** The same description, with empty slots left out, so a result can be written. @param {SubtractionPart} a @param {SubtractionPart} b @returns {boolean} */
function equal(a, b) {
  if (a === b) return true
  if (!isNode(a) || !isNode(b) || a.op !== b.op || a.parts.length !== b.parts.length) return false
  return a.parts.every((part, i) => equal(part, b.parts[i]))
}

/**
 * The descriptions of a character, read as parts. An adapter answers `{ text }` rows; a search
 * answers its parse trees directly. Both are accepted here, so the same rule serves each.
 * @param {string} char
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @returns {SubtractionPart[]}
 */
function readDescriptions(char, describe) {
  /** @type {SubtractionPart[]} */
  const out = []
  for (const entry of describe(char)) {
    if (typeof entry === 'string') {
      const read = parse(entry, { open: true })
      out.push(read.problem || read.tree === null ? entry : read.tree)
      continue
    }
    if (entry !== null && typeof entry === 'object' && 'text' in entry) {
      const read = parse(entry.text, { open: true })
      if (!read.problem && read.tree !== null) out.push(read.tree)
      continue
    }
    if (entry !== null) out.push(entry)
  }
  return out
}

/**
 * The results of taking one occurrence of `target` out of `tree`, following each character's
 * descriptions, at most `maxDepth` characters deep. Answers `[GONE]` when the whole tree was taken,
 * `[]` when it does not hold `target`, and otherwise the trees that stand in its place. A node whose
 * parts cannot be written with its operator (two parts left of three, for example) gives no result,
 * since the description would no longer mean the same shape.
 * @param {SubtractionPart} tree
 * @param {SubtractionPart} target
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} [maxDepth]
 * @returns {(SubtractionPart | typeof GONE)[]}
 */
function subtractOnce(tree, target, describe, maxDepth = 8) {
  /**
   * @param {SubtractionPart} part
   * @param {Set<string>} seen characters already opened on this branch
   * @param {number} depth characters opened so far
   * @returns {Map<string, SubtractionPart | typeof GONE>}
   */
  function walk(part, seen, depth) {
    /** @type {Map<string, SubtractionPart | typeof GONE>} */
    const out = new Map()
    /** @param {SubtractionPart | typeof GONE} result */
    const add = result => {
      const key = result === GONE ? '\u0000' : write(result)
      if (!out.has(key)) out.set(key, result)
    }
    if (equal(part, target)) { add(GONE); return out }
    if (typeof part === 'string') {
      if (depth >= maxDepth || seen.has(part) || !plain(part)) return out
      const inner = new Set(seen).add(part)
      for (const description of readDescriptions(part, describe)) {
        for (const result of walk(description, inner, depth + 1).values()) add(result)
      }
      return out
    }
    if (part === null || !plain(part)) return out
    // What ㇯ takes away, and what it takes it from, do not stand in the character: a description
    // that is itself a subtraction is not a sequence of parts to take one out of.
    if (part.op === '㇯') return out
    part.parts.forEach((child, index) => {
      for (const result of walk(child, seen, depth).values()) {
        const parts = part.parts.slice()
        if (result === GONE) parts.splice(index, 1)
        else parts[index] = result
        if (parts.length === 0) add(GONE)
        else if (parts.length === 1) add(parts[0])
        else if (parts.length === arity(part.op)) add({ ...part, parts })
      }
    })
    return out
  }
  return [...walk(tree, new Set(), 0).values()]
}

/**
 * The remainders of a subtraction `㇯S X`: one for each way S decomposes into a sequence holding X.
 * `GONE` is left out, since an empty description is not a spelling to offer.
 * @param {SubtractionPart} tree the first operand, S
 * @param {SubtractionPart} target the second operand, X
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} [maxDepth]
 * @returns {SubtractionPart[]}
 */
export function subtractionRemainders(tree, target, describe, maxDepth = 8) {
  if (!plain(tree) || !plain(target)) return []
  return /** @type {SubtractionPart[]} */ (subtractOnce(tree, target, describe, maxDepth).filter(result => result !== GONE))
}

/**
 * `tree` with every `㇯S X` whose S holds X rewritten to the first remainder. Other subtractions stay
 * as they are, so a description that cannot be read from the data keeps its notation.
 * @param {SubtractionPart} tree
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} [maxDepth]
 * @returns {SubtractionPart}
 */
export function normalizeSubtractions(tree, describe, maxDepth = 8) {
  if (!isNode(tree)) return tree
  const parts = tree.parts.map(part => normalizeSubtractions(part, describe, maxDepth))
  const node = { ...tree, parts }
  if (node.op !== '㇯' || node.parts.length !== 2 || node.note || node.marks) return node
  const [from, take] = node.parts
  if (from === null || take === null || !plain(from) || !plain(take)) return node
  const [first] = subtractionRemainders(from, take, describe, maxDepth)
  return first ?? node
}

/**
 * `text` with every subtraction its decompositions resolve rewritten, or `text` unchanged when it
 * does not read as a description or nothing resolves.
 * @param {string} text
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} [maxDepth]
 * @returns {string}
 */
export function normalizeSubtractionText(text, describe, maxDepth = 8) {
  const read = parse(text, { open: true })
  if (read.problem || !isNode(read.tree)) return text
  const normalized = normalizeSubtractions(read.tree, describe, maxDepth)
  return write(normalized) === write(read.tree) ? text : write(normalized)
}
