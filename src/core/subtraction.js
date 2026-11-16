// @ts-check
// Subtraction as a description: ㇯SX takes X out of what S decomposes into, so ㇯軍車 is 冖 because
// 軍 is ⿱冖車. A description is read only as far as a character's own decomposition, and a node
// left with one part collapses to that part. An index after the operator names which of several
// like parts goes, from 0 in reading order: ㇯[1]王一 is 王 less its middle 一. A part a stroke chain
// draws is not read into, so its strokes are neither counted nor taken (zi.tools IDS Extension §6.7).
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

/** A part taken out where its operator cannot be written with what is left: the part is counted
 * in its place, and no description stands for the result. */
const UNWRITTEN = Symbol('unwritten')
/** The most readings of one part kept apart: each is a way the part's descriptions spell it. */
const READINGS = 64

/** @typedef {SubtractionPart | typeof GONE | typeof UNWRITTEN} Taken */

/** The index a subtraction's modifier names: `[1]` is 1, no modifier is 0, anything else is no
 * index (null). @param {string | undefined} note @returns {number | null} */
export const subtractionIndex = note => !note ? 0 : /^\d+$/.test(note) ? Number(note) : null

/** Whether `part` is what `target` names: the same description, and no stroke chain, whose part is
 * neither counted nor taken (zi.tools IDS Extension §6.7). @param {SubtractionPart} part @param {SubtractionPart} target */
const names = (part, target) => equal(part, target) && !(typeof part === 'string' && part.startsWith('#('))

/** What stands in `part`'s place once its child at `index` became `result`. @param {import('./ids.js').Node} part @param {number} index @param {Taken} result @returns {Taken} */
function replaced(part, index, result) {
  if (result === UNWRITTEN) return result
  const parts = part.parts.slice()
  if (result === GONE) parts.splice(index, 1)
  else parts[index] = result
  if (parts.length === 0) return GONE
  if (parts.length === 1) return parts[0]
  return parts.length === arity(part.op) ? { ...part, parts } : UNWRITTEN
}

/**
 * Every result of taking one occurrence of `target` out of `tree`, through each character's
 * descriptions, at most `maxDepth` characters deep: `GONE` when the whole tree was taken, and
 * nothing for a node whose parts can no longer be written with its operator (two parts left of
 * three), since the description would no longer mean the same shape.
 * @param {SubtractionPart} tree
 * @param {SubtractionPart} target
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} maxDepth
 * @returns {(SubtractionPart | typeof GONE)[]}
 */
function subtractAny(tree, target, describe, maxDepth) {
  /** @param {SubtractionPart} part @param {Set<string>} seen @param {number} depth @returns {Map<string, SubtractionPart | typeof GONE>} */
  function walk(part, seen, depth) {
    /** @type {Map<string, SubtractionPart | typeof GONE>} */
    const out = new Map()
    /** @param {Taken} result */
    const add = result => {
      if (result === UNWRITTEN) return
      const key = result === GONE ? '\u0000' : write(result)
      if (!out.has(key)) out.set(key, result)
    }
    if (names(part, target)) { add(GONE); return out }
    if (typeof part === 'string') {
      if (depth >= maxDepth || seen.has(part) || !plain(part)) return out
      const inner = new Set(seen).add(part)
      for (const description of readDescriptions(part, describe)) for (const result of walk(description, inner, depth + 1).values()) add(result)
      return out
    }
    // What ㇯ takes away, and what it takes it from, do not stand in the character: a description
    // that is itself a subtraction is not a sequence of parts to take one out of.
    if (part === null || !plain(part) || part.op === '㇯') return out
    part.parts.forEach((child, index) => { for (const result of walk(child, seen, depth).values()) add(replaced(part, index, result)) })
    return out
  }
  return [...walk(tree, new Set(), 0).values()]
}

/**
 * The ways of taking one occurrence of `target` out of `tree`, counted in reading order. Each
 * reading is one way `tree` and the characters in it are spelled, and lists, for each occurrence in
 * reading order (an occurrence that is `target` whole is not looked into), what stands in `tree`'s
 * place once that one is taken: `GONE` when the whole tree was taken, `UNWRITTEN` where a node's
 * parts can no longer be written with its operator. Of a character's spellings only those showing
 * the most occurrences are read, so a spelling that hides some (尖 as ⿱𡭔大, with no 小) does not
 * shift the count.
 * @param {SubtractionPart} tree
 * @param {SubtractionPart} target
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} maxDepth
 * @returns {Taken[][]}
 */
function subtractOrdered(tree, target, describe, maxDepth) {
  /** @param {Taken} result */
  const keyOf = result => result === GONE ? '\u0000' : result === UNWRITTEN ? '\u0001' : write(result)
  /** The readings with their duplicates left out, at most `READINGS` of them. @param {Taken[][]} readings */
  const distinct = readings => {
    /** @type {Map<string, Taken[]>} */
    const out = new Map()
    for (const reading of readings) {
      const key = reading.map(keyOf).join('\u0002')
      if (!out.has(key) && out.size < READINGS) out.set(key, reading)
    }
    return [...out.values()]
  }
  /** @param {SubtractionPart} part @param {Set<string>} seen @param {number} depth @returns {Taken[][]} */
  function walk(part, seen, depth) {
    if (names(part, target)) return [[GONE]]
    if (typeof part === 'string') {
      if (depth >= maxDepth || seen.has(part) || !plain(part)) return [[]]
      const inner = new Set(seen).add(part)
      const readings = readDescriptions(part, describe).flatMap(description => walk(description, inner, depth + 1))
      const most = Math.max(0, ...readings.map(reading => reading.length))
      const fullest = readings.filter(reading => reading.length === most)
      return fullest.length ? distinct(fullest) : [[]]
    }
    if (part === null || !plain(part) || part.op === '㇯') return [[]]
    /** @type {Taken[][]} */
    let readings = [[]]
    part.parts.forEach((child, index) => {
      const own = walk(child, seen, depth).map(reading => reading.map(result => replaced(part, index, result)))
      readings = distinct(readings.flatMap(before => own.map(after => [...before, ...after])))
    })
    return readings
  }
  return walk(tree, new Set(), 0)
}

/**
 * The remainders of a subtraction `㇯S X`: for each way S decomposes into a sequence holding X, what
 * is left once X is taken. With `index`, only the occurrence it names is taken, counted from 0 in
 * reading order, as `㇯[1]王一` takes the middle 一 of 王; without it, each occurrence is. `GONE`
 * is left out, since an empty description is not a spelling to offer.
 * @param {SubtractionPart} tree the first operand, S
 * @param {SubtractionPart} target the second operand, X
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {{ index?: number, maxDepth?: number }} [options]
 * @returns {SubtractionPart[]}
 */
export function subtractionRemainders(tree, target, describe, { index, maxDepth = 8 } = {}) {
  if (!plain(tree) || !plain(target)) return []
  const results = index === undefined ? subtractAny(tree, target, describe, maxDepth)
    : subtractOrdered(tree, target, describe, maxDepth).flatMap(reading => reading.slice(index, index + 1))
  /** @type {Map<string, SubtractionPart>} */
  const out = new Map()
  for (const result of results) if (result !== GONE && result !== UNWRITTEN && !out.has(write(result))) out.set(write(result), result)
  return [...out.values()]
}

/**
 * `tree` with every `㇯S X` whose S holds X rewritten to the first remainder, taking the occurrence
 * its index names (`㇯[2]王一` is 干). Other subtractions stay as they are, so a description that
 * cannot be read from the data keeps its notation.
 * @param {SubtractionPart} tree
 * @param {(char: string) => readonly (SubtractionPart | string | { text: string })[]} describe
 * @param {number} [maxDepth]
 * @returns {SubtractionPart}
 */
export function normalizeSubtractions(tree, describe, maxDepth = 8) {
  if (!isNode(tree)) return tree
  const parts = tree.parts.map(part => normalizeSubtractions(part, describe, maxDepth))
  const node = { ...tree, parts }
  const index = subtractionIndex(node.note)
  if (node.op !== '㇯' || node.parts.length !== 2 || index === null || node.marks) return node
  const [from, take] = node.parts
  if (from === null || take === null || !plain(from) || !plain(take)) return node
  const [first] = subtractionRemainders(from, take, describe, { index, maxDepth })
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
