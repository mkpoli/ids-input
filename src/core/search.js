// @ts-check
// Characters found by what their descriptions hold, over a table of descriptions (BabelStone IDS).
//
// A query is one or more terms, apart by spaces, and a character is found when every term matches
// it. A term starting with an operator (or its ASCII name) is a structure: it matches wherever its
// shape stands in the character's description, at any depth, components opened into their own
// descriptions as needed, so ⿱木⿰木木 finds 森 (⿱木林, 林 being ⿰木木). An empty slot (⬚, or a pasted ＋) or ？ in it
// matches any part, a component or a whole subtree. Any other term is a run of components the
// character must hold, counted (木木 finds 林 and 森, not 本), at any depth. Components match across
// their radical and positional forms (⺡, 氵 and 水 are one), from a table of forms, and ⿻ matches its
// parts in either order.
//
// Hits are ranked by how close they are: a match of the whole description first, then by how deep
// the match lies, how many components had to be opened to reach it, and how much else the character
// holds, and among equals the common ideographs first. Each hit carries the description it matched in, opened where the match needed it, and the
// spans of it the terms matched, for highlighting.
import { EMPTY_MARKS, UNKNOWN, arity, entryDescription, isComponent, isDescription, isSequence } from './ids.js'
import { unalias } from './aliases.js'
import { lookupChar, tokens, unencoded } from './decompose.js'
import { createStructuralSearch } from './structural-search.js'
import { searchShape, SHAPE_COMPONENTS } from './search-shapes.js'

/**
 * @typedef {string | { op: string, parts: Tree[], from?: string }} Tree A component, or a node; `from` names the component a node was opened from.
 * @typedef {string | import('./search-shapes.js').Shape} QueryLeaf
 * @typedef {null | QueryLeaf | { op: string, parts: Pattern[] }} Pattern A query's structure; null matches any part.
 * @typedef {{ kind: 'structure', text: string, tree: Pattern, leaves: QueryLeaf[] } | { kind: 'components', text: string, leaves: QueryLeaf[] }} Term
 * @typedef {{ char: string, sequence: string, spans: [number, number][], score: number }} Hit
 */

/** The common ideographs (U+4E00–9FFF) first, then Extension A, then the rest: a rarer character ranks as if a little farther. @param {string} char */
const tier = char => { const cp = /** @type {number} */ (char.codePointAt(0)); return cp >= 0x4E00 && cp <= 0x9FFF ? 0 : cp >= 0x3400 && cp <= 0x4DBF ? 1 : 2 }

/** How many components deep a match may open. */
export const OPEN_DEPTH = 6
/** The most terms a query takes. */
export const TERMS = 8

/** zi.tools' two wildcard expressions for looking up components.
 * @param {string} text @returns {{ kind: 'parts' | 'containing', char: string } | null} */
export function componentQuery(text) {
  const special = tokens(unalias((text ?? '').trim()))
  if (special.length !== 3 || special[0] !== '㇯') return null
  const [, left, right] = special
  const wildcard = (/** @type {string} */ part) => part === UNKNOWN || EMPTY_MARKS.includes(part)
  if (wildcard(left) && !wildcard(right) && isComponent(right)) return { kind: 'containing', char: right }
  if (wildcard(right) && !wildcard(left) && isComponent(left)) return { kind: 'parts', char: left }
  return null
}

/** A description's tokens as a tree; a token short of its operands reads as ？. @param {string[]} list @param {{ at: number }} cursor @returns {Tree} */
function readTree(list, cursor) {
  const token = list[cursor.at++] ?? UNKNOWN
  const n = arity(token)
  return n ? { op: token, parts: Array.from({ length: n }, () => readTree(list, cursor)) } : token
}

/**
 * A query read into its terms, or a problem: `empty` (nothing to find), `extra` (a structure with more
 * than its operators take) or `terms` (more than TERMS).
 * @param {string} text
 * @param {{ literal?: boolean }} [options]
 * @returns {{ terms: Term[], problem?: 'empty' | 'extra' | 'terms' }}
 */
export function parseQuery(text, { literal = false } = {}) {
  const written = (text ?? '').split(/[\s　]+/).map(t => unalias(t)).filter(Boolean)
  /** @type {Term[]} */
  const terms = []
  for (const term of written) {
    // A zi.tools entry searches for the description it carries.
    const shape = entryDescription(term)
    // Compose Hangul only: whole-term NFC would also change compatibility ideographs.
    const matching = shape.replace(/\p{Script=Hangul}+/gu, run => run.normalize('NFC'))
    const typed = tokens(matching), list = literal ? typed : typed.map((token, i) => searchShape(token, typed[i + 1]))
    if (isSequence(shape)) {
      const cursor = { at: 0 }
      /** @returns {Pattern} */
      const read = () => {
        const token = list[cursor.at++] ?? UNKNOWN
        if (typeof token !== 'string') return token
        const n = arity(token)
        return n ? { op: token, parts: Array.from({ length: n }, read) }
          : EMPTY_MARKS.includes(token) || token === UNKNOWN ? null : token
      }
      const tree = read()
      if (cursor.at < list.length) return { terms, problem: 'extra' }
      /** @type {QueryLeaf[]} */
      const leaves = []
      /** @param {Pattern} p */
      const collect = p => { if (p === null) return; if (typeof p === 'string' || 'anyOf' in p) leaves.push(p); else p.parts.forEach(collect) }
      collect(tree)
      terms.push({ kind: 'structure', text: term, tree, leaves })
    } else {
      // A following kana voicing mark keeps the preceding kana literal without asking for
      // another component. A mark typed alone remains searchable.
      const components = list.filter((token, i) => !(typeof token === 'string'
        && /^[゙゚゛゜]$/u.test(token) && i > 0
        && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(typed[i - 1])))
      const leaves = components.filter(t => typeof t !== 'string' || ((isComponent([...t][0]) || SHAPE_COMPONENTS.has([...t][0])) && t !== UNKNOWN && !EMPTY_MARKS.includes(t)))
      if (leaves.length) terms.push({ kind: 'components', text: term, leaves })
    }
  }
  if (!terms.length) return { terms, problem: 'empty' }
  if (terms.length > TERMS) return { terms, problem: 'terms' }
  return { terms }
}

/**
 * The forms table (`data/component-forms.tsv`: form TAB char TAB source TAB detail) as a map from
 * every form to the one it is folded to, so all forms of a component fold alike.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function readForms(text) {
  /** @type {Map<string, string>} */
  const parent = new Map()
  /** @param {string} x @returns {string} */
  const root = x => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = /** @type {string} */ (parent.get(r)); return r }
  for (const line of (text ?? '').split('\n')) {
    if (!line || line.startsWith('#') || line.startsWith('form\t')) continue
    const [form, char] = line.split('\t')
    if (!form || !char) continue
    const a = root(form), b = root(char)
    // The encoded ideograph (the larger code point's side is a radical form) stands for its class.
    if (a !== b) { if (/** @type {number} */ (a.codePointAt(0)) < 0x3400 && /** @type {number} */ (b.codePointAt(0)) >= 0x3400) parent.set(a, b); else parent.set(b, a) }
  }
  /** @type {Map<string, string>} */
  const folded = new Map()
  for (const x of parent.keys()) folded.set(x, root(x))
  return folded
}

/**
 * Assign each request one compatible resource without exceeding its count. With partial=true,
 * return a maximum matching and mark unmatched requests -1 (for ranking and highlighting).
 * @param {number[][]} needs @param {(id: number) => number} capacity @param {boolean} [partial]
 * @returns {number[] | null}
 */
function allocate(needs, capacity, partial = false) {
  /** @type {Map<number, number[]>} */
  const owners = new Map()
  const assigned = needs.map(() => -1)
  /** @param {number} request @param {Set<number>} seen @returns {boolean} */
  const place = (request, seen) => {
    for (const id of needs[request]) {
      if (seen.has(id) || capacity(id) <= 0) continue
      seen.add(id)
      const held = owners.get(id) ?? []
      if (held.length < capacity(id)) { held.push(request); owners.set(id, held); assigned[request] = id; return true }
      for (let i = 0; i < held.length; i++) if (place(held[i], seen)) { held[i] = request; assigned[request] = id; return true }
    }
    return false
  }
  for (let i = 0; i < needs.length; i++) if (!place(i, new Set()) && !partial) return null
  return assigned
}

/** Structural equality accepts encoded equivalents and explicitly positional forms.
 * Broad radical variants can change orientation or multiplicity (𡿨/巜/巛, 丿/乀).
 * @param {string} text @returns {Map<string, string>} */
export function readStructuralForms(text) {
  return readForms(text.split(/\r?\n/).filter(line => {
    const [, , source, detail = ''] = line.split('\t')
    return source === 'unicode-ucd' && detail === 'EquivalentUnifiedIdeograph'
      || /^radical-variant (left|right|top|bottom)$/.test(detail)
  }).join('\n'))
}

/**
 * A search over `table` (char → its descriptions, region tags dropped) folding components by `forms`
 * (from `readForms`). The index of what each character holds is built on the first query.
 * @param {Map<string, string[]>} table
 * @param {{ forms?: Map<string, string>, structuralForms?: Map<string, string> }} [options]
 */
export function createSearch(table, { forms = new Map(), structuralForms = new Map() } = {}) {
  /** @param {string} c */
  const fold = c => forms.get(c) ?? forms.get([...c][0]) ?? c
  /** @param {QueryLeaf} leaf */
  const choices = leaf => [...new Set((typeof leaf === 'string' ? [leaf] : leaf.anyOf).map(fold))]
  /** @type {Map<string, Tree[]>} */
  const trees = new Map()
  /** @param {string} char @returns {Tree[]} */
  const treesOf = char => {
    let found = trees.get(char)
    if (!found) {
      found = (table.get(char) ?? []).filter(isSequence).map(text => readTree(tokens(text), { at: 0 }))
      trees.set(char, found)
    }
    return found
  }

  // What each character holds at any depth, folded and counted; of several descriptions, the most
  // any one names of each component. Operators are held too, under their own characters. Kept
  // compact: each key a number, each character's holdings a sorted run of [key, count] pairs, and
  // each key's holders a run of character numbers.
  /** @type {Map<string, number>} */
  const keyOf = new Map()
  /** @param {string} k */
  const key = k => { let id = keyOf.get(k); if (id === undefined) { id = keyOf.size; keyOf.set(k, id) } return id }
  /** @type {Map<string, Int32Array>} */
  const held = new Map()
  const EMPTY_HELD = new Int32Array(0)
  /** @type {{ chars: string[], of: Map<number, Int32Array> } | null} */
  let holders = null
  // A character whose holdings were cut short by a cycle (水 is ⿰㇇𰛅 and 𰛅 is ㇯水㇇) is worked out
  // again when next asked, never kept half done.
  /** @type {Set<string>} */
  const cut = new Set()
  /**
   * What one description holds, counted: its components and operators, and what its components
   * hold in turn. The operands of ㇯ do not stand in the character, so only ㇯ itself is counted,
   * and a character never holds itself.
   * @param {Tree} tree @param {string} char @param {Set<string>} path @returns {Map<number, number>}
   */
  function holdingsIn(tree, char, path) {
    /** @type {Map<number, number>} */
    const here = new Map()
    /** @param {number} k @param {number} n */
    const add = (k, n) => here.set(k, (here.get(k) ?? 0) + n)
    /** @param {Tree} t */
    const walk = t => {
      if (typeof t !== 'string') { add(key(t.op), 1); if (t.op !== '㇯') t.parts.forEach(walk); return }
      if (t === UNKNOWN || unencoded(t) !== null || t === char) return
      add(key(fold(t)), 1)
      const inner = holdingsOf(t, path)
      for (let i = 0; i < inner.length; i += 2) add(inner[i], inner[i + 1])
    }
    walk(tree)
    here.delete(key(fold(char)))
    return here
  }
  /** @param {string} char @param {Set<string>} path @returns {Int32Array} */
  function holdingsOf(char, path) {
    const known = held.get(char)
    if (known) return known
    if (path.has(char) || path.size > 12) { for (const c of path) cut.add(c); return EMPTY_HELD }
    path.add(char)
    /** @type {Map<number, number>} */
    const most = new Map()
    for (const tree of treesOf(char)) for (const [k, n] of holdingsIn(tree, char, path)) if (n > (most.get(k) ?? 0)) most.set(k, n)
    path.delete(char)
    const ks = [...most.keys()].sort((x, y) => x - y), out = new Int32Array(ks.length * 2)
    ks.forEach((k, i) => { out[2 * i] = k; out[2 * i + 1] = /** @type {number} */ (most.get(k)) })
    // Asked for itself (nothing above it on the path), a character's holdings are whole.
    if (cut.has(char) && path.size) cut.delete(char)
    else { cut.delete(char); held.set(char, out) }
    return out
  }
  /** How many of key `k` a character's holdings hold. @param {Int32Array} run @param {number} k */
  const countIn = (run, k) => {
    let lo = 0, hi = run.length / 2 - 1
    while (lo <= hi) { const mid = (lo + hi) >> 1, at = run[2 * mid]; if (at === k) return run[2 * mid + 1]; if (at < k) lo = mid + 1; else hi = mid - 1 }
    return 0
  }
  function index() {
    if (holders) return holders
    const chars = [...table.keys()]
    /** @type {Map<number, number>} */
    const sizes = new Map()
    for (const char of chars) { const run = holdingsOf(char, new Set()); for (let i = 0; i < run.length; i += 2) sizes.set(run[i], (sizes.get(run[i]) ?? 0) + 1) }
    /** @type {Map<number, Int32Array>} */
    const of = new Map()
    /** @type {Map<number, number>} */
    const fill = new Map()
    for (const [k, n] of sizes) { of.set(k, new Int32Array(n)); fill.set(k, 0) }
    chars.forEach((char, c) => {
      const run = /** @type {Int32Array} */ (held.get(char))
      for (let i = 0; i < run.length; i += 2) { const k = run[i], at = /** @type {number} */ (fill.get(k)); /** @type {Int32Array} */ (of.get(k))[at] = c; fill.set(k, at + 1) }
    })
    trees.clear()
    holders = { chars, of }
    return holders
  }

  /**
   * Keep nested alternate descriptions mutually exclusive. States count fulfilled query groups,
   * not distributions of Han components: all six イ alternatives are interchangeable when the
   * query only repeats イ. Counts are capped by demand; dominated partial matches are discarded.
   * @param {number[][]} needs
   */
  function consistentRun(needs) {
    /** @type {number[][]} */
    const groups = []
    /** @type {number[]} */
    const limits = []
    const byGroup = new Map()
    for (const choices of needs) {
      const sorted = choices.slice().sort((a, b) => a - b), name = sorted.join(',')
      let i = byGroup.get(name)
      if (i === undefined) { i = groups.length; byGroup.set(name, i); groups.push(sorted); limits.push(0) }
      limits[i]++
    }
    const ids = new Set(needs.flat()), zero = groups.map(() => 0)
    /** @typedef {{ states: number[][], cut: boolean }} Matches */
    /** @type {Map<string, number[][]>} */
    const cache = new Map()
    /** @param {number[]} state */
    const full = state => state.every((n, i) => n === limits[i])
    /** @param {number[][]} into @param {number[]} state */
    const keep = (into, state) => {
      if (into.some(other => state.every((n, i) => other[i] >= n))) return
      for (let i = into.length - 1; i >= 0; i--) if (into[i].every((n, j) => state[j] >= n)) into.splice(i, 1)
      into.push(state)
    }
    /** @param {number[][]} left @param {number[][]} right */
    const add = (left, right) => {
      /** @type {number[][]} */
      const out = []
      for (const a of left) for (const b of right) {
        const state = a.map((n, i) => Math.min(limits[i], n + b[i]))
        if (full(state)) return [state]
        keep(out, state)
      }
      return out
    }
    /** @param {number | undefined} id @param {Set<number>} blocked */
    const direct = (id, blocked) => {
      if (id === undefined || blocked.has(id)) return [zero]
      const matching = groups.flatMap((choices, i) => choices.includes(id) ? [zero.map((_, j) => i === j ? 1 : 0)] : [])
      return matching.length ? matching : [zero]
    }
    /** @param {string} char @param {Set<string>} path @param {Set<number>} blocked @returns {Matches} */
    const describe = (char, path, blocked) => {
      if (path.has(char) || path.size > 12) return { states: [zero], cut: true }
      // As in holdingsIn, a component's expansion never supplies another copy of itself.
      const own = keyOf.get(fold(char)), without = new Set(blocked)
      if (own !== undefined && ids.has(own)) without.add(own)
      const cacheKey = char + ':' + [...without].sort((a, b) => a - b).join(',')
      const known = cache.get(cacheKey)
      if (known) return { states: known, cut: false }
      const maximum = held.get(char) ?? EMPTY_HELD
      if (![...ids].some(id => !without.has(id) && countIn(maximum, id))) return { states: [zero], cut: false }
      const inner = new Set([...path, char])
      /** @type {number[][]} */
      const states = []
      let cut = false
      for (const tree of treesOf(char)) {
        const result = walk(tree, char, inner, without)
        cut ||= result.cut
        for (const state of result.states) keep(states, state)
      }
      const out = states.length ? states : [zero]
      if (!cut) cache.set(cacheKey, out)
      return { states: out, cut }
    }
    /** @param {Tree} tree @param {string} char @param {Set<string>} path @param {Set<number>} blocked @returns {Matches} */
    const walk = (tree, char, path, blocked) => {
      if (typeof tree === 'string') {
        if (tree === char || tree === UNKNOWN || unencoded(tree) !== null) return { states: [zero], cut: false }
        const inner = describe(tree, path, blocked)
        return { states: add(direct(keyOf.get(fold(tree)), blocked), inner.states), cut: inner.cut }
      }
      if (tree.op === '㇯') return { states: [zero], cut: false }
      let states = [zero], cut = false
      for (const part of tree.parts) {
        const inner = walk(part, char, path, blocked)
        states = add(states, inner.states)
        cut ||= inner.cut
      }
      return { states, cut }
    }
    // Cheap necessary bounds count the most resources available in one compatible expansion.
    // Per-key maxima alone incorrectly add resources from mutually exclusive descriptions.
    const bounds = [[...ids], ...groups].map((wanted, i) => {
      const target = new Set(wanted), demand = i === 0 ? needs.length : limits[i - 1]
      /** @type {Map<string, number>} */
      const memo = new Map()
      /** @param {Tree} tree @param {string} char @param {Set<string>} path @param {Set<number>} blocked @returns {{ count: number, cut: boolean }} */
      const maximum = (tree, char, path, blocked) => {
        if (typeof tree !== 'string') {
          if (tree.op === '㇯') return { count: 0, cut: false }
          let count = 0, cut = false
          for (const part of tree.parts) {
            const result = maximum(part, char, path, blocked)
            count += result.count; cut ||= result.cut
          }
          return { count: Math.min(demand, count), cut }
        }
        if (tree === char || tree === UNKNOWN || unencoded(tree) !== null) return { count: 0, cut: false }
        const id = keyOf.get(fold(tree)), direct = id !== undefined && target.has(id) && !blocked.has(id) ? 1 : 0
        if (path.has(tree) || path.size > 12) return { count: direct, cut: true }
        const without = new Set(blocked)
        if (id !== undefined && target.has(id)) without.add(id)
        const name = tree + ':' + [...without].sort((a, b) => a - b).join(',')
        const known = memo.get(name)
        if (known !== undefined) return { count: Math.min(demand, direct + known), cut: false }
        let count = 0, cut = false
        const inner = new Set([...path, tree])
        for (const description of treesOf(tree)) {
          const result = maximum(description, tree, inner, without)
          count = Math.max(count, result.count); cut ||= result.cut
        }
        if (!cut) memo.set(name, count)
        return { count: Math.min(demand, direct + count), cut }
      }
      return { maximum, demand }
    })
    // A complete greedy assignment is a valid witness. Incomplete assignments still use the
    // exact frontier below, so traversal order can never remove a legitimate result.
    /** @param {Tree} tree @param {string} char @param {Set<string>} path @param {Set<number>} blocked @param {number[]} state @returns {number[]} */
    const witness = (tree, char, path, blocked, state) => {
      if (full(state)) return state
      if (typeof tree !== 'string') {
        if (tree.op === '㇯') return state
        for (const part of tree.parts) state = witness(part, char, path, blocked, state)
        return state
      }
      if (tree === char || tree === UNKNOWN || unencoded(tree) !== null) return state
      const id = keyOf.get(fold(tree))
      let next = state.slice()
      if (id !== undefined && !blocked.has(id)) {
        const available = groups.map((_, i) => i).filter(i => next[i] < limits[i] && groups[i].includes(id))
        available.sort((a, b) => groups[a].length - groups[b].length)
        if (available.length) next[available[0]]++
      }
      if (full(next) || path.has(tree) || path.size > 12) return next
      const without = new Set(blocked)
      if (id !== undefined && ids.has(id)) without.add(id)
      const maximum = held.get(tree) ?? EMPTY_HELD
      if (![...ids].some(k => !without.has(k) && countIn(maximum, k))) return next
      const inner = new Set([...path, tree]), start = next
      let score = next.reduce((a, b) => a + b, 0)
      for (const description of treesOf(tree)) {
        const trial = witness(description, tree, inner, without, start)
        if (full(trial)) return trial
        const got = trial.reduce((a, b) => a + b, 0)
        if (got > score) { next = trial; score = got }
      }
      return next
    }
    /** @param {Tree} tree @param {string} char */
    return (tree, char) => {
      const own = keyOf.get(fold(char)), blocked = new Set(own !== undefined && ids.has(own) ? [own] : [])
      const path = new Set([char])
      if (bounds.some(({ maximum, demand }) => maximum(tree, char, path, blocked).count < demand)) return false
      if (full(witness(tree, char, path, blocked, zero))) return true
      return walk(tree, char, path, blocked).states.some(full)
    }
  }

  /**
   * `pattern` matched against `data`: the data subtree, components opened where the pattern needed
   * them, or null. `opened` counts the components opened.
   * @param {Pattern} pattern @param {Tree} data @param {number} depth @param {{ opened: number }} cost
   * @returns {Tree | null}
   */
  function match(pattern, data, depth, cost) {
    if (pattern === null) return data
    if (typeof pattern === 'string' || 'anyOf' in pattern) return typeof data === 'string' && choices(pattern).includes(fold(data)) ? data : null
    if (typeof data !== 'string') {
      if (data.op !== pattern.op || data.parts.length !== pattern.parts.length) return null
      // ⿻ lays its parts over each other, so either order is the same shape.
      if (pattern.op === '⿻') {
        const swapped = { op: pattern.op, parts: [pattern.parts[1], pattern.parts[0]] }
        const trial = { opened: cost.opened }
        const straight = matchParts(pattern, data, depth, trial)
        if (straight !== null) { cost.opened = trial.opened; return straight }
        return matchParts(swapped, data, depth, cost)
      }
      return matchParts(pattern, data, depth, cost)
    }
    // A component standing where the pattern has structure: opened into its descriptions.
    if (depth >= OPEN_DEPTH) return null
    for (const tree of treesOf(data)) {
      const trial = { opened: cost.opened + 1 }
      const got = match(pattern, tree, depth + 1, trial)
      if (got !== null) { cost.opened = trial.opened; return typeof got === 'string' ? got : { ...got, from: data } }
    }
    return null
  }

  /**
   * A node's parts matched in order.
   * @param {{ op: string, parts: Pattern[] }} pattern @param {{ op: string, parts: Tree[], from?: string }} data @param {number} depth @param {{ opened: number }} cost
   * @returns {Tree | null}
   */
  function matchParts(pattern, data, depth, cost) {
    /** @type {Tree[]} */
    const parts = []
    for (let i = 0; i < data.parts.length; i++) {
      const got = match(pattern.parts[i], data.parts[i], depth, cost)
      if (got === null) return null
      parts.push(got)
    }
    return parts.some((p, i) => p !== data.parts[i]) ? { ...data, parts } : data
  }

  /**
   * The closest place `pattern` stands in `data`: the whole of it rebuilt with the match (and every
   * component opened on the way to it), the path to the match, and its cost.
   * @param {Pattern} pattern @param {Tree} data @param {number} depth
   * @returns {{ tree: Tree, path: number[], depth: number, opened: number } | null}
   */
  function find(pattern, data, depth) {
    const cost = { opened: 0 }
    const here = match(pattern, data, depth, cost)
    /** @type {{ tree: Tree, path: number[], depth: number, opened: number } | null} */
    let best = here === null ? null : { tree: here, path: [], depth: 0, opened: cost.opened }
    if (best && best.opened === 0) return best
    if (typeof data === 'string') {
      if (depth >= OPEN_DEPTH || data === UNKNOWN || unencoded(data) !== null) return best
      // Inside a component: in its first description that holds the pattern.
      for (const tree of treesOf(data)) {
        const inner = find(pattern, tree, depth + 1)
        if (!inner) continue
        if (!best || (inner.depth * 4 + (inner.opened + 1) * 2) < best.depth * 4 + best.opened * 2)
          best = { tree: typeof inner.tree === 'string' ? inner.tree : { ...inner.tree, from: data }, path: inner.path, depth: inner.depth, opened: inner.opened + 1 }
        break
      }
      return best
    }
    const node = data
    // What ㇯ takes away, and what it takes it from, do not stand in the character.
    if (node.op === '㇯') return best
    node.parts.forEach((part, i) => {
      const inner = find(pattern, part, depth)
      if (!inner || (best && best.depth * 4 + best.opened * 2 <= (inner.depth + 1) * 4 + inner.opened * 2)) return
      const parts = node.parts.slice()
      parts[i] = inner.tree
      best = { tree: { ...node, parts }, path: [i, ...inner.path], depth: inner.depth + 1, opened: inner.opened }
    })
    return best
  }

  /** A tree written out, with the code-point span of the part at each of `paths`. @param {Tree} tree @param {number[][]} paths */
  function written(tree, paths) {
    const out = /** @type {string[]} */ ([]), spans = /** @type {[number, number][]} */ ([])
    let at = 0
    /** @param {Tree} t @param {number[]} path */
    const write = (t, path) => {
      const marks = paths.filter(p => p.length === path.length && p.every((x, i) => x === path[i]))
      const start = at
      if (typeof t === 'string') { out.push(t); at += [...t].length } else { out.push(t.op); at += 1; t.parts.forEach((p, i) => write(p, [...path, i])) }
      for (const _ of marks) spans.push([start, at])
    }
    write(tree, [])
    return { text: out.join(''), spans }
  }

  /** The encoded parts named in a character's descriptions, including parts of those parts.
   * @param {string} char @param {number} limit @returns {{ hits: Hit[], total: number }} */
  function partsOf(char, limit) {
    /** @type {Map<string, number>} */
    const depths = new Map()
    const root = lookupChar(char)
    /** @type {[string, number][]} */
    const queue = [[root, 0]]
    const visited = new Set([root])
    for (let i = 0; i < queue.length; i++) {
      const [current, depth] = queue[i]
      /** @param {Tree} tree */
      const visit = tree => {
        if (typeof tree !== 'string') {
          // A subtraction's operands do not necessarily survive in the resulting character.
          if (tree.op !== '㇯') tree.parts.forEach(visit)
          return
        }
        const base = lookupChar(tree)
        if (base === root || base === current || tree === UNKNOWN || unencoded(tree) !== null || !isComponent(tree)) return
        if (!depths.has(tree)) depths.set(tree, depth + 1)
        if (!visited.has(base)) { visited.add(base); queue.push([base, depth + 1]) }
      }
      for (const tree of treesOf(current)) visit(tree)
      // Some entries are aliases expressed as a single component rather than an IDS.
      for (const text of table.get(current) ?? []) {
        const list = tokens(text)
        if (list.length === 1 && !isSequence(text)) visit(list[0])
      }
    }
    const sorted = [...depths].sort((a, b) => a[1] - b[1] || tier(a[0]) - tier(b[0])
      || /** @type {number} */ (a[0].codePointAt(0)) - /** @type {number} */ (b[0].codePointAt(0)))
    const hits = sorted.slice(0, limit).map(([part, depth]) => {
      const description = (table.get(lookupChar(part)) ?? []).find(isDescription)
      return { char: part, sequence: description ?? part, spans: [], score: depth }
    })
    return { hits, total: sorted.length }
  }

  /** The containing lookup, including single-component alias descriptions.
   * @param {string} part @param {number} limit @returns {{ hits: Hit[], total: number }} */
  function containingPart(part, limit) {
    const firstLeaf = parseQuery(part).terms[0]?.leaves[0]
    const excludeSelf = !firstLeaf || choices(firstLeaf).includes(fold(part))
    /** @type {Map<string, string[]>} */
    const aliases = new Map()
    for (const [char, descriptions] of table) for (const text of descriptions) {
      const list = tokens(text)
      if (list.length !== 1 || list[0] === char || isSequence(text) || unencoded(list[0]) !== null || !isComponent(list[0])) continue
      const key = fold(list[0])
      if (!aliases.has(key)) aliases.set(key, [])
      aliases.get(key)?.push(char)
    }
    const queue = [part], seen = new Set([fold(part)])
    /** @type {Map<string, Hit>} */
    const found = new Map()
    /** @param {string} key */
    const addAliases = key => {
      for (const char of aliases.get(key) ?? []) {
        if ((char !== part || !excludeSelf) && !found.has(char)) found.set(char, { char, sequence: char, spans: [], score: 0 })
        const folded = fold(char)
        if (!seen.has(folded)) { seen.add(folded); queue.push(char) }
      }
    }
    if (firstLeaf) for (const key of choices(firstLeaf)) addAliases(key)
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]
      // An alias is a literal component in the source data, even when it looks like kana
      // that the ordinary query parser treats as a visual substitute.
      for (const hit of search(current, { limit: Infinity, literal: i > 0 }).hits) {
        const old = found.get(hit.char)
        if ((i === 0 || hit.char !== part || !excludeSelf) && (!old || hit.score < old.score)) found.set(hit.char, hit)
        addAliases(fold(hit.char))
      }
      addAliases(fold(current))
    }
    const sorted = [...found.values()].sort((a, b) => a.score - b.score || tier(a.char) - tier(b.char)
      || /** @type {number} */ (a.char.codePointAt(0)) - /** @type {number} */ (b.char.codePointAt(0)))
    return { hits: sorted.slice(0, limit), total: sorted.length }
  }

  /**
   * The characters `query` finds, closest first, at most `limit`, and how many there are.
   * @param {string} query
   * @param {{ limit?: number, literal?: boolean, componentLookup?: boolean }} [options]
   * @returns {{ hits: Hit[], total: number, problem?: 'empty' | 'extra' | 'terms' }}
   */
  function search(query, { limit = 60, literal = false, componentLookup = true } = {}) {
    // zi.tools uses a wildcard on one side of ㇯ for component lookup. An empty editor slot
    // means the same thing for search, while ？ remains accepted in imported expressions.
    const special = componentLookup ? componentQuery(query) : null
    if (special?.kind === 'containing') return containingPart(special.char, limit)
    if (special?.kind === 'parts') return partsOf(special.char, limit)
    const { terms, problem } = parseQuery(query, { literal })
    if (problem) return { hits: [], total: 0, problem }
    const by = index()
    // Each leaf needs one of its alternatives. Keep the descriptions' keys separate: an イ
    // query may find 人 or 井, but a literal 人 query must never start finding 井.
    const requested = terms.map(term => term.leaves.map(leaf => choices(leaf)
      .map(k => keyOf.get(k)).filter((id) => id !== undefined)))
    const consistent = terms.map((term, i) => term.kind === 'components' && requested[i].length > 1
      ? consistentRun(requested[i]) : null)
    const required = requested.map((leaves, i) => {
      const all = leaves.slice(), term = terms[i]
      if (term.kind === 'structure') {
        /** @param {Pattern} p */
        const ops = p => { if (p && typeof p !== 'string' && !('anyOf' in p)) { const id = keyOf.get(p.op); all.push(id === undefined ? [] : [id]); p.parts.forEach(ops) } }
        ops(term.tree)
      }
      return all
    })
    if (required.some(needs => needs.some(ids => !ids.length))) return { hits: [], total: 0 }
    // Start with the rarest union of alternative postings, never their Cartesian product.
    const groups = new Map(required.flat().map(ids => [ids.join(','), ids]))
    const rarest = [...groups.values()].sort((a, b) =>
      a.reduce((n, id) => n + (by.of.get(id)?.length ?? 0), 0) - b.reduce((n, id) => n + (by.of.get(id)?.length ?? 0), 0))[0]
    if (!rarest) return { hits: [], total: 0 }
    const first = new Set(rarest.flatMap(id => [...(by.of.get(id) ?? [])]))
    /** @type {{ char: string, tree: Tree, paths: number[][], score: number }[]} */
    const found = []
    for (const c of first) {
      const char = by.chars[c], holds = /** @type {Int32Array} */ (held.get(char))
      if (required.some(needs => !allocate(needs, id => countIn(holds, id)))) continue
      // Every structure term placed in one of the character's descriptions; the closest wins.
      /** @type {{ tree: Tree, paths: number[][], score: number } | null} */
      let best = null
      for (const tree of treesOf(char)) {
        /** @param {Tree} t @returns {number} */
        const count = t => typeof t === 'string' ? 1 : t.parts.reduce((n, p) => n + count(p), 0)
        let root = tree, score = 0, ok = true
        /** @type {number[][]} */
        const paths = []
        for (const term of terms) {
          if (term.kind !== 'structure') continue
          const found = find(term.tree, root, 0)
          if (!found) { ok = false; break }
          root = found.tree
          paths.push(found.path)
          score += found.depth * 4 + found.opened * 2
        }
        if (!ok) continue
        // Every components term held by this one description, not by several together. A component
        // inside it counts the most any one of its own descriptions holds of each part.
        const runs = terms.filter(term => term.kind === 'components')
        if (runs.length) {
          const holds = holdingsIn(tree, char, new Set([char]))
          if (terms.some((term, i) => term.kind === 'components'
            && (!allocate(requested[i], id => holds.get(id) ?? 0) || consistent[i]?.(tree, char) === false))) continue
        }
        // Match top-level components with the same allocation used for counts. An ambiguous
        // alias cannot consume a component needed by a more specific request.
        terms.forEach((term, i) => {
          if (term.kind !== 'components') return
          /** @type {Map<number, number>} */
          const top = new Map()
          /** @param {Tree} t */
          const collect = t => {
            if (typeof t === 'string') { const id = keyOf.get(fold(t)); if (id !== undefined) top.set(id, (top.get(id) ?? 0) + 1) }
            else t.parts.forEach(collect)
          }
          collect(tree)
          const assigned = allocate(requested[i], id => top.get(id) ?? 0, true)
          score += (assigned ?? []).filter(id => id === -1).length
        })
        score = score * 10 + count(tree)
        if (best === null || score < best.score) best = { tree: root, paths, score }
      }
      if (!best) continue
      // The whole description matched exactly comes first; a description with more parts, later.
      const exact = terms.length === 1 && terms[0].kind === 'structure' && best.paths[0]?.length === 0 && !EMPTY_MARKS.some(mark => terms[0].text.includes(mark)) && !terms[0].text.includes(UNKNOWN)
      found.push({ char, tree: best.tree, paths: best.paths, score: (exact ? -1000 : 0) + best.score + tier(char) * 15 })
    }
    found.sort((a, b) => a.score - b.score || tier(a.char) - tier(b.char) || /** @type {number} */ (a.char.codePointAt(0)) - /** @type {number} */ (b.char.codePointAt(0)))
    // Only the hits handed back are written out, with their spans.
    const hits = found.slice(0, limit).map(({ char, tree, paths, score }) => {
      const { text, spans } = written(tree, paths)
      // Allocate highlighted occurrences too, so overlapping alias families do not reuse a leaf.
      terms.forEach((term, i) => {
        if (term.kind !== 'components') return
        const writtenTokens = tokens(text)
        /** @type {Map<number, number>} */
        const counts = new Map()
        for (const token of writtenTokens) { const id = keyOf.get(fold(token)); if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1) }
        const assigned = allocate(requested[i], id => counts.get(id) ?? 0, true) ?? []
        const wanted = new Map()
        for (const id of assigned) if (id !== -1) wanted.set(id, (wanted.get(id) ?? 0) + 1)
        let at = 0
        for (const token of writtenTokens) {
          const len = [...token].length, id = keyOf.get(fold(token))
          if (id !== undefined && wanted.get(id)) { spans.push([at, at + len]); wanted.set(id, wanted.get(id) - 1) }
          at += len
        }
      })
      return { char, sequence: text, spans, score }
    })
    return { hits, total: found.length }
  }
  const structural = createStructuralSearch(table, { forms: structuralForms })
  return { search, structure: structural.search, index: () => { index() }, fold }
}
