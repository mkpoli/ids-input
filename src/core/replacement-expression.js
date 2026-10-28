// @ts-check
// Replacement expressions embedded in an IDS or another replacement. They resolve to ordinary IDS
// before reaching the editor, so the rest of the editor continues to work with its usual tree.
import { EMPTY_MARKS, LONGEST, UNKNOWN, arity, isComponent, isSelector, isSequence, nextEmpty, parse, write } from './ids.js'
import { unalias } from './aliases.js'
import { replacementPrefix, resolveReplacement } from './replacement.js'

/** @typedef {string | { empty: true } | { op: string, parts: Expression[] } | { replace: [Expression, Expression, Expression] }} Expression */

/** Replacement text stays literal while its operands are being typed. RP inside an IDS can also
 * be literal Latin components; keeping the text literal does not change how a completed plain IDS
 * is parsed. @param {string} text */
export const replacementInput = text => {
  if (replacementPrefix(text)) return true
  const plain = unalias(text)
  const read = parse(plain, { open: true })
  const complete = !read.problem && read.tree !== null && !nextEmpty(read.tree)
  return isSequence(plain) && !complete && ((text ?? '').includes('🔄') || /rp/i.test(text ?? ''))
}

/** Expand ordinary ASCII operator aliases outside replacement operands. Operands retain literal
 * Latin components while they are being typed; complete replacements can be followed by aliases.
 * @param {string} input @returns {string} */
export function unaliasReplacementInput(input) {
  const plain = unalias(input)
  const read = parse(plain, { open: true })
  if (isSequence(plain) && !read.problem && read.tree !== null && !nextEmpty(read.tree)) return plain
  const chars = [...input]
  /** @param {number} start @returns {number} */
  function end(start) {
    const char = chars[start]
    if (char === undefined) return -1
    const named = /^r$/i.test(char) && /^p$/i.test(chars[start + 1] ?? '')
    const replacement = char === '🔄' || named
    const n = replacement ? 3 : arity(char)
    let at = start + (named ? 2 : 1)
    if (replacement && !named && (chars[at] === '\uFE0E' || chars[at] === '\uFE0F')) at++
    if (!n) return isSelector(chars[at]) ? at + 1 : at
    for (let i = 0; i < n; i++) { at = end(at); if (at < 0) return -1 }
    return at
  }
  let result = '', at = 0
  while (at < chars.length) {
    let start = at
    while (start < chars.length && chars[start] !== '🔄' && !(/^r$/i.test(chars[start]) && /^p$/i.test(chars[start + 1] ?? ''))) start++
    result += unalias(chars.slice(at, start).join(''))
    if (start === chars.length) break
    const finish = end(start)
    if (finish < 0) return result + chars.slice(start).join('')
    result += chars.slice(start, finish).join('')
    at = finish
  }
  return result
}

/** Maximum size of a nested expression before it resolves to the editor's smaller tree. */
export const REPLACEMENT_EXPRESSION_LIMIT = LONGEST * 4

/** Read a complete expression containing at least one replacement. A replacement's operands may
 * themselves contain replacements. For ordinary IDS input use the usual parser instead.
 * @param {string} input @returns {Expression | null} */
export function replacementExpression(input) {
  const chars = [...(input ?? '').trim()]
  if (!chars.length || chars.length > REPLACEMENT_EXPRESSION_LIMIT) return null
  // A completed ordinary IDS with literal Latin components is never a replacement expression.
  if (!replacementPrefix(input) && !parse(input, { open: true }).problem) return null
  /** @typedef {{ tree: Expression, end: number, replaced: boolean }} Candidate */
  /** @typedef {{ parts: Expression[], end: number, replaced: boolean }} State */
  /** @type {Map<string, Candidate[]>} */
  const memo = new Map()
  /** Read all distinct endings, preferring an RP operator when both interpretations fit.
   * Memoizing by position and retaining only one tree per ending bounds ambiguous Latin input.
   * @param {number} at @param {boolean} restricted @returns {Candidate[]} */
  function read(at, restricted) {
    const key = `${at}:${restricted}`, cached = memo.get(key)
    if (cached) return cached
    const char = chars[at]
    if (char === undefined) return []
    /** @type {Candidate[]} */
    const result = []
    /** @param {number} start @param {number} count @param {boolean} inner @returns {State[]} */
    function children(start, count, inner) {
      /** @type {State[]} */
      let states = [{ parts: [], end: start, replaced: false }]
      for (let i = 0; i < count; i++) {
        /** @type {Map<string, State>} */
        const next = new Map()
        for (const state of states) for (const child of read(state.end, inner)) {
          const replaced = state.replaced || child.replaced
          const key = `${child.end}:${replaced}`
          if (!next.has(key)) next.set(key, { parts: [...state.parts, child.tree], end: child.end, replaced })
        }
        states = [...next.values()]
      }
      return states
    }
    const named = (char === 'R' || char === 'r') && (chars[at + 1] === 'P' || chars[at + 1] === 'p')
    if (char === '🔄' || named) {
      let start = at + (named ? 2 : 1)
      if (!named && (chars[start] === '\uFE0E' || chars[start] === '\uFE0F')) start++
      for (const child of children(start, 3, true)) result.push({ tree: { replace: /** @type {[Expression, Expression, Expression]} */ (child.parts) }, end: child.end, replaced: true })
      // RP can be two literal Latin components; a Unicode replacement symbol cannot.
      if (char === '🔄') { memo.set(key, result); return result }
    }
    const n = arity(char)
    if (n) {
      for (const child of children(at + 1, n, restricted)) result.push({ tree: { op: char, parts: child.parts }, end: child.end, replaced: child.replaced })
    } else if (EMPTY_MARKS.includes(char) && !restricted) {
      result.push({ tree: { empty: true }, end: at + 1, replaced: false })
    } else if (isComponent(char) && !EMPTY_MARKS.includes(char) && !(restricted && char === UNKNOWN)) {
      const end = isSelector(chars[at + 1]) ? at + 2 : at + 1
      result.push({ tree: chars.slice(at, end).join(''), end, replaced: false })
    }
    memo.set(key, result)
    return result
  }
  return read(0, false).find(candidate => candidate.end === chars.length && candidate.replaced)?.tree ?? null
}

/** Resolve the innermost replacements first, returning a standard editable IDS tree. A missing
 * match, an oversized result, or an incomplete expression returns null.
 * @param {Expression} expression
 * @param {(char: string) => Promise<{ text: string }[]>} structure
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<import('./ids.js').Part | null>} */
export async function resolveReplacementExpression(expression, structure, { signal } = {}) {
  /** @type {Map<string, Promise<{ text: string }[]>>} */
  const cached = new Map()
  /** @param {string} char */
  const lookup = char => { if (!cached.has(char)) cached.set(char, structure(char)); return /** @type {Promise<{ text: string }[]>} */ (cached.get(char)) }
  /** @param {Expression} node @returns {Promise<import('./ids.js').Part | undefined>} */
  async function resolve(node) {
    signal?.throwIfAborted()
    if (typeof node === 'string') return node
    if ('empty' in node) return null
    if ('replace' in node) {
      const [source, target, replacement] = node.replace
      const a = await resolve(source)
      if (a == null) return undefined
      const b = await resolve(target)
      if (b == null) return undefined
      const c = await resolve(replacement)
      if (c == null) return undefined
      return (await resolveReplacement({ source: write(a), target: write(b), replacement: write(c) }, lookup, { signal })) ?? undefined
    }
    /** @type {import('./ids.js').Part[]} */
    const parts = []
    for (const child of node.parts) {
      const value = await resolve(child)
      if (value === undefined) return undefined
      parts.push(value)
    }
    return { op: node.op, parts }
  }
  const tree = await resolve(expression)
  if (tree == null) return null
  const text = write(tree)
  return [...text].length > LONGEST || parse(text, { open: true }).problem ? null : tree
}
