// @ts-check
// Characters found by what their descriptions hold, over a table of descriptions (BabelStone IDS).
//
// A query is one or more terms, apart by spaces, and a character is found when every term matches
// it. A term starting with an operator (or its ASCII name) is a structure: it matches wherever its
// shape stands in the character's description, at any depth, components opened into their own
// descriptions as needed, so ⿱木⿰木木 finds 森 (⿱木林, 林 being ⿰木木). An empty slot (＋) or ？ in it
// matches any part, a component or a whole subtree. Any other term is a run of components the
// character must hold, counted (木木 finds 林 and 森, not 本), at any depth. Components match across
// their radical and positional forms (⺡, 氵 and 水 are one), from a table of forms.
//
// Hits are ranked by how close they are: a match of the whole description first, then by how deep
// the match lies, how many components had to be opened to reach it, and how much else the character
// holds, and among equals the common ideographs first. Each hit carries the description it matched in, opened where the match needed it, and the
// spans of it the terms matched, for highlighting.
import { EMPTY, UNKNOWN, arity, isComponent, isSequence } from './ids.js'
import { unalias } from './aliases.js'
import { tokens } from './decompose.js'

/**
 * @typedef {string | { op: string, parts: Tree[], from?: string }} Tree A component, or a node; `from` names the component a node was opened from.
 * @typedef {null | string | { op: string, parts: Pattern[] }} Pattern A query's structure; null matches any part.
 * @typedef {{ kind: 'structure', text: string, tree: Pattern, leaves: string[] } | { kind: 'components', text: string, leaves: string[] }} Term
 * @typedef {{ char: string, sequence: string, spans: [number, number][], score: number }} Hit
 */

/** Among hits as close as each other, the common ideographs (U+4E00–9FFF) first, then Extension A, then the rest. @param {string} char */
const tier = char => { const cp = /** @type {number} */ (char.codePointAt(0)); return cp >= 0x4E00 && cp <= 0x9FFF ? 0 : cp >= 0x3400 && cp <= 0x4DBF ? 1 : 2 }

/** How many components deep a match may open. */
export const OPEN_DEPTH = 6
/** The most terms a query takes. */
export const TERMS = 8

/** A description's tokens as a tree; a token short of its operands reads as ？. @param {string[]} list @param {{ at: number }} cursor @returns {Tree} */
function readTree(list, cursor) {
  const token = list[cursor.at++] ?? UNKNOWN
  const n = arity(token)
  return n ? { op: token, parts: Array.from({ length: n }, () => readTree(list, cursor)) } : token
}

/**
 * A query read into its terms, or a problem: `empty` (nothing to find) or `terms` (more than TERMS).
 * @param {string} text
 * @returns {{ terms: Term[], problem?: 'empty' | 'terms' }}
 */
export function parseQuery(text) {
  const written = (text ?? '').split(/[\s　]+/).map(t => unalias(t)).filter(Boolean)
  /** @type {Term[]} */
  const terms = []
  for (const term of written) {
    if (isSequence(term)) {
      /** @type {(t: Tree) => Pattern} */
      const pattern = t => typeof t === 'string' ? (t === EMPTY || t === UNKNOWN ? null : t) : { op: t.op, parts: t.parts.map(pattern) }
      const tree = pattern(readTree(tokens(term), { at: 0 }))
      /** @type {string[]} */
      const leaves = []
      /** @param {Pattern} p */
      const collect = p => { if (typeof p === 'string') leaves.push(p); else if (p) p.parts.forEach(collect) }
      collect(tree)
      terms.push({ kind: 'structure', text: term, tree, leaves })
    } else {
      const leaves = tokens(term).filter(t => isComponent([...t][0]) && t !== UNKNOWN && t !== EMPTY)
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
 * A search over `table` (char → its descriptions, region tags dropped) folding components by `forms`
 * (from `readForms`). The index of what each character holds is built on the first query.
 * @param {Map<string, string[]>} table
 * @param {{ forms?: Map<string, string> }} [options]
 */
export function createSearch(table, { forms = new Map() } = {}) {
  /** @param {string} c */
  const fold = c => forms.get(c) ?? forms.get([...c][0]) ?? c
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
  /** @param {string} char @param {Set<string>} path @returns {Int32Array} */
  function holdingsOf(char, path) {
    const known = held.get(char)
    if (known) return known
    if (path.has(char) || path.size > 12) return EMPTY_HELD
    path.add(char)
    /** @type {Map<number, number>} */
    const most = new Map()
    for (const tree of treesOf(char)) {
      /** @type {Map<number, number>} */
      const here = new Map()
      /** @param {number} k @param {number} n */
      const add = (k, n) => here.set(k, (here.get(k) ?? 0) + n)
      /** @param {Tree} t */
      const walk = t => {
        if (typeof t !== 'string') { add(key(t.op), 1); t.parts.forEach(walk); return }
        if (t === UNKNOWN || t.startsWith('{')) return
        add(key(fold(t)), 1)
        if (t !== char) { const inner = holdingsOf(t, path); for (let i = 0; i < inner.length; i += 2) add(inner[i], inner[i + 1]) }
      }
      walk(tree)
      for (const [k, n] of here) if (n > (most.get(k) ?? 0)) most.set(k, n)
    }
    path.delete(char)
    const ks = [...most.keys()].sort((x, y) => x - y), out = new Int32Array(ks.length * 2)
    ks.forEach((k, i) => { out[2 * i] = k; out[2 * i + 1] = /** @type {number} */ (most.get(k)) })
    held.set(char, out)
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
   * `pattern` matched against `data`: the data subtree, components opened where the pattern needed
   * them, or null. `opened` counts the components opened.
   * @param {Pattern} pattern @param {Tree} data @param {number} depth @param {{ opened: number }} cost
   * @returns {Tree | null}
   */
  function match(pattern, data, depth, cost) {
    if (pattern === null) return data
    if (typeof pattern === 'string') return typeof data === 'string' && fold(data) === fold(pattern) ? data : null
    if (typeof data !== 'string') {
      if (data.op !== pattern.op || data.parts.length !== pattern.parts.length) return null
      /** @type {Tree[]} */
      const parts = []
      for (let i = 0; i < data.parts.length; i++) {
        const got = match(pattern.parts[i], data.parts[i], depth, cost)
        if (got === null) return null
        parts.push(got)
      }
      return parts.some((p, i) => p !== data.parts[i]) ? { ...data, parts } : data
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
      if (depth >= OPEN_DEPTH || data === UNKNOWN || data.startsWith('{')) return best
      // Inside a component: in its first description that holds the pattern.
      for (const tree of treesOf(data)) {
        const inner = find(pattern, tree, depth + 1)
        if (!inner) continue
        if (!best || inner.depth + inner.opened + 1 < best.depth + best.opened)
          best = { tree: typeof inner.tree === 'string' ? inner.tree : { ...inner.tree, from: data }, path: inner.path, depth: inner.depth, opened: inner.opened + 1 }
        break
      }
      return best
    }
    const node = data
    node.parts.forEach((part, i) => {
      const inner = find(pattern, part, depth)
      if (!inner || (best && best.depth + best.opened <= inner.depth + 1 + inner.opened)) return
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

  /**
   * The characters `query` finds, closest first, at most `limit`, and how many there are.
   * @param {string} query
   * @param {{ limit?: number }} [options]
   * @returns {{ hits: Hit[], total: number, problem?: 'empty' | 'terms' }}
   */
  function search(query, { limit = 60 } = {}) {
    const { terms, problem } = parseQuery(query)
    if (problem) return { hits: [], total: 0, problem }
    const by = index()
    // What every term needs held, counted, as the first filter: the components and the operators.
    /** @type {Map<string, number>} */
    const need = new Map()
    for (const term of terms) {
      /** @type {Map<string, number>} */
      const counts = new Map()
      for (const leaf of term.leaves) counts.set(fold(leaf), (counts.get(fold(leaf)) ?? 0) + 1)
      if (term.kind === 'structure') {
        /** @param {Pattern} p */
        const ops = p => { if (p && typeof p !== 'string') { counts.set(p.op, (counts.get(p.op) ?? 0) + 1); p.parts.forEach(ops) } }
        ops(term.tree)
      }
      for (const [k, n] of counts) if (n > (need.get(k) ?? 0)) need.set(k, n)
    }
    /** @type {[number, number][]} */
    const wanted = []
    for (const [k, n] of need) { const id = keyOf.get(k); if (id === undefined) return { hits: [], total: 0 }; wanted.push([id, n]) }
    wanted.sort((a, b) => (by.of.get(a[0])?.length ?? 0) - (by.of.get(b[0])?.length ?? 0))
    const first = by.of.get(wanted[0][0])
    if (!first) return { hits: [], total: 0 }
    /** @type {{ char: string, tree: Tree, paths: number[][], score: number }[]} */
    const found = []
    for (const c of first) {
      const char = by.chars[c], holds = /** @type {Int32Array} */ (held.get(char))
      if (wanted.some(([k, n]) => countIn(holds, k) < n)) continue
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
        score = score * 10 + count(tree)
        if (best === null || score < best.score) best = { tree: root, paths, score }
      }
      if (!best) continue
      // The whole description matched exactly comes first; a description with more parts, later.
      const exact = terms.length === 1 && terms[0].kind === 'structure' && best.paths[0]?.length === 0 && !terms[0].text.includes(EMPTY) && !terms[0].text.includes(UNKNOWN)
      found.push({ char, tree: best.tree, paths: best.paths, score: (exact ? -1000 : 0) + best.score })
    }
    found.sort((a, b) => a.score - b.score || tier(a.char) - tier(b.char) || /** @type {number} */ (a.char.codePointAt(0)) - /** @type {number} */ (b.char.codePointAt(0)))
    // Only the hits handed back are written out, with their spans.
    const hits = found.slice(0, limit).map(({ char, tree, paths, score }) => {
      const { text, spans } = written(tree, paths)
      // A components term is shown on the leaves that hold its components.
      for (const term of terms) if (term.kind === 'components') {
        const want = term.leaves.map(fold)
        let at = 0
        for (const token of tokens(text)) {
          const len = [...token].length, i = want.indexOf(fold(token))
          if (i >= 0) { spans.push([at, at + len]); want.splice(i, 1) }
          at += len
        }
      }
      return { char, sequence: text, spans, score }
    })
    return { hits, total: found.length }
  }
  return { search, index: () => { index() }, fold }
}
