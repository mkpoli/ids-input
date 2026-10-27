// @ts-check
import { parse, write } from './ids.js'

/** @typedef {import('./ids.js').Part} Tree */
/** @typedef {import('./search.js').Hit} Hit */

/** Presets use letters for repeated components, ⬚ for any component, and | for alternatives. */
export const STRUCTURAL_PRESETS = [
  { id: 'pyramid', examples: '品 森', query: '⿱A⿰AA' },
  { id: 'grid', examples: '㗊 燚', query: '⿱⿰AA⿰AA | ⿰⿱AA⿱AA' },
  { id: 'pairRow', examples: '林 朋', query: '⿰AA' },
  { id: 'pairColumn', examples: '昌 炎', query: '⿱AA' },
  { id: 'tripleRow', examples: '巛 雦', query: '⿲AAA | ⿰A⿰AA | ⿰⿰AAA' },
  { id: 'tripleColumn', examples: '彡 𡭯', query: '⿳AAA | ⿱A⿱AA | ⿱⿱AAA' },
  { id: 'betweenRow', examples: '弼 辨', query: '⿲ABA | ⿰A⿰BA | ⿰⿰ABA' },
  { id: 'betweenColumn', examples: '亘 器', query: '⿳ABA | ⿱A⿱BA | ⿱⿱ABA' },
  { id: 'enclosed', examples: '回 囚', query: '⿴AB' },
  { id: 'corner', examples: '病 府', query: '⿸AB' },
  { id: 'overlap', examples: '本 巫', query: '⿻AB' },
]

/** Whole-character structural matching, with bounded opening of encoded components.
 * @param {Map<string, string[]>} table
 * @param {{ forms?: Map<string, string> }} [options]
 */
export function createStructuralSearch(table, { forms = new Map() } = {}) {
  /** @param {string} c */
  const fold = c => forms.get(c) ?? c
  /** @type {Map<string, Tree[]>} */
  const cache = new Map()
  /** @param {string} c @returns {Tree[]} */
  function trees(c) {
    if (!cache.has(c)) cache.set(c, (table.get(c) ?? []).flatMap(text => {
      const p = parse(text)
      return p.problem || !p.tree || typeof p.tree === 'string' ? [] : [p.tree]
    }))
    return /** @type {Tree[]} */ (cache.get(c))
  }
  /** Yield a shared expansion, so a repeated variable cannot use incompatible alternatives.
   * @param {Tree} a @param {Tree} b @param {number} depth @returns {Generator<Tree>} */
  function* unifyRaw(a, b, depth) {
    if (a === null || b === null || a === '？' || b === '？') return
    if (typeof a === 'string' && typeof b === 'string' && fold(a) === fold(b)) { yield fold(a); return }
    if (typeof a !== 'string' && typeof b !== 'string') {
      if (a.op !== b.op) return
      const left = a, right = b
      /** @param {number} i @param {Tree[]} parts @returns {Generator<Tree>} */
      function* children(i, parts) {
        if (i === left.parts.length) { yield { op: left.op, parts }; return }
        for (const common of unify(left.parts[i], right.parts[i], depth)) yield* children(i + 1, [...parts, common])
      }
      yield* children(0, [])
      return
    }
    if (depth === 0) return
    if (typeof a === 'string') for (const t of trees(a)) yield* unify(t, b, depth - 1)
    if (typeof b === 'string') for (const t of trees(b)) yield* unify(a, t, depth - 1)
  }
  /** @type {Map<string, Tree[]>} */
  const shared = new Map()
  /** Deduplicate at every level before combining alternatives; cache only complete traversals.
   * @param {Tree} a @param {Tree} b @param {number} depth @returns {Generator<Tree>} */
  function* unify(a, b, depth) {
    const key = JSON.stringify([write(a), write(b), depth])
    const cached = shared.get(key)
    if (cached) { yield* cached; return }
    /** @type {Map<string, Tree>} */
    const unique = new Map()
    for (const tree of unifyRaw(a, b, depth)) {
      const text = write(tree)
      if (!unique.has(text)) { unique.set(text, tree); yield tree }
    }
    if (shared.size < 20000) shared.set(key, [...unique.values()])
  }
  /** @typedef {{ tree: Tree, bindings: Map<string, Tree> }} Match */
  /** Backtrack across alternative decompositions with separate variable bindings.
   * @param {Tree} pattern @param {Tree} tree @param {Map<string, Tree>} bindings @param {number} depth
   * @returns {Generator<Match>} */
  function* match(pattern, tree, bindings, depth) {
    if (pattern === null || pattern === '？') { yield { tree, bindings }; return }
    if (typeof pattern === 'string') {
      if (/^[A-Z]$/.test(pattern)) {
        if (tree === null || tree === '？') return
        if (bindings.has(pattern)) {
          for (const common of unify(/** @type {Tree} */ (bindings.get(pattern)), tree, depth))
            yield { tree, bindings: new Map([...bindings, [pattern, common]]) }
        } else yield { tree, bindings: new Map([...bindings, [pattern, tree]]) }
      } else if (!unify(pattern, tree, depth).next().done) yield { tree, bindings }
      return
    }
    if (typeof tree === 'string') {
      if (depth > 0) for (const opened of trees(tree)) yield* match(pattern, opened, bindings, depth - 1)
      return
    }
    if (!tree || pattern.op !== tree.op) return
    const node = pattern
    /** @param {number} i @param {Tree[]} parts @param {Map<string, Tree>} vars @returns {Generator<Match>} */
    function* children(i, parts, vars) {
      if (i === node.parts.length) { yield { tree: { op: node.op, parts }, bindings: vars }; return }
      for (const next of match(node.parts[i], /** @type {import('./ids.js').Node} */ (tree).parts[i], vars, depth))
        yield* children(i + 1, [...parts, next.tree], next.bindings)
    }
    yield* children(0, [], bindings)
  }
  /** @param {string} query @param {{ limit?: number }} [options]
   * @returns {{ hits: Hit[], total: number, characters: string, problem?: 'empty' | 'pattern' }} */
  function search(query, { limit = 60 } = {}) {
    shared.clear()
    if (!query.trim()) return { hits: [], total: 0, characters: '', problem: 'empty' }
    const texts = query.split('|').map(s => s.replace(/\s/gu, '').replace(/[⬚＋]/gu, '？'))
    const patterns = texts.map(text => parse(text))
    if (patterns.length > 8 || patterns.some(p => p.problem || !p.tree || typeof p.tree === 'string'))
      return { hits: [], total: 0, characters: '', problem: 'pattern' }
    /** @type {Hit[]} */
    const hits = []
    for (const char of table.keys()) {
      let result = null
      outer: for (const tree of trees(char)) for (const p of patterns) {
        const first = match(/** @type {Tree} */ (p.tree), tree, new Map(), 6).next()
        if (!first.done) { result = first.value.tree; break outer }
      }
      if (result !== null) {
        const sequence = write(result)
        hits.push({ char, sequence, spans: [[0, [...sequence].length]], score: 0 })
      }
    }
    // Common unified characters first, then code point order within each block.
    const tier = (/** @type {string} */ c) => { const cp = c.codePointAt(0) ?? 0; return cp >= 0x4e00 && cp <= 0x9fff ? 0 : cp >= 0x3400 && cp <= 0x4dbf ? 1 : 2 }
    hits.sort((a, b) => tier(a.char) - tier(b.char) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
    return { hits: hits.slice(0, Math.max(0, limit)), total: hits.length, characters: hits.map(h => h.char).join('') }
  }
  return { search }
}
