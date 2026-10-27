// @ts-check
// Characters found by their components: 水骨 and 氵冖月 each find 滑, over a table of descriptions.
//
// A character's components are every character its descriptions name, and theirs in turn: 滑 is
// ⿰氵骨 and 骨 is ⿳𭁟冖⺝, so 滑 holds 氵, 骨, 𭁟, 冖 and ⺝. A character with several descriptions (one
// per source region) holds the most any one of them names of each component, so two regional forms
// never add up to two. Components are counted: 木木 finds 林 and 森 but not 本.
import { arity } from '../core/ids.js'
import { tokens, unencoded } from '../core/decompose.js'

/** The most parts a query takes. */
export const PARTS = 8
/** How many of the rarest component's characters a query reads. */
export const SCAN = 3000

/**
 * @typedef {{ held: Map<string, number>, size: number, top: Set<string> }} Described
 * @typedef {[string, any]} Tree A leaf ['leaf', text] or a node [operator, operands]
 */

/** @param {string[]} list @param {number} at @returns {[Tree, number]} */
function parseTokens(list, at) {
  const token = list[at] ?? '？'
  const n = arity(token)
  if (!n) return [['leaf', token], at + 1]
  /** @type {Tree[]} */
  const operands = []
  let next = at + 1
  for (let k = 0; k < n; k++) { const [operand, after] = parseTokens(list, next); operands.push(operand); next = after }
  return [[token, operands], next]
}

/** @param {Map<string, number>} into @param {Map<string, number>} from */
const add = (into, from) => { for (const [k, n] of from) into.set(k, (into.get(k) ?? 0) + n) }

/**
 * A component search over `table` (char → its sequences, region tags dropped).
 * @param {Map<string, string[]>} table
 * @param {{ fold?: (char: string) => string }} [options]
 */
export function componentIndex(table, { fold = char => char } = {}) {
  /** @type {Map<string, Described>} */
  const described = new Map()
  /** @type {Map<string, Tree[]>} */
  const trees = new Map()
  /** @param {string} char */
  const treesOf = char => {
    let found = trees.get(char)
    if (!found) { found = (table.get(char) ?? []).map(text => parseTokens(tokens(text), 0)[0]); trees.set(char, found) }
    return found
  }

  /**
   * @param {Tree} node @param {string} char @param {Set<string>} path
   * @returns {[Described, boolean]}
   */
  function evaluate(node, char, path) {
    const [kind, value] = node
    if (kind === 'leaf') {
      const leaf = /** @type {string} */ (value)
      if (leaf === char || leaf === '？' || unencoded(leaf) !== null) return [{ held: new Map(), size: 1, top: new Set() }, false]
      // A description leading back to a character being expanded describes nothing new.
      if (path.has(leaf)) return [{ held: new Map(), size: 1, top: new Set() }, true]
      const [inner, short] = describe(leaf, new Set([...path, char]))
      const held = new Map([[fold(leaf), 1]])
      add(held, inner.held)
      return [{ held, size: 1 + inner.size, top: new Set([fold(leaf)]) }, short]
    }
    const parts = []
    let short = false
    for (const operand of /** @type {Tree[]} */ (value)) {
      const [part, stopped] = evaluate(operand, char, path)
      parts.push(part)
      short ||= stopped
    }
    if (kind === '㇯') {
      // The second operand is taken from the first: the character holds what the first is built from
      // less the second, and not the first itself (乌, ㇯鸟丶, is no 鸟).
      const [whole, taken] = parts
      const held = new Map(whole.held)
      const minuend = /** @type {Tree[]} */ (value)[0]
      if (minuend[0] === 'leaf') held.delete(fold(/** @type {string} */ (minuend[1])))
      for (const [k, n] of taken.held) held.set(k, (held.get(k) ?? 0) - n)
      for (const [k, n] of held) if (n <= 0) held.delete(k)
      return [{ held, size: Math.max(whole.size - taken.size, 1), top: new Set() }, short]
    }
    const held = new Map()
    for (const part of parts) add(held, part.held)
    return [{ held, size: parts.reduce((sum, p) => sum + p.size, 0), top: new Set(parts.flatMap(p => [...p.top])) }, short]
  }

  /** @param {string} char @param {Set<string>} path @returns {[Described, boolean]} */
  function describe(char, path) {
    const kept = described.get(char)
    if (kept) return [kept, false]
    /** @type {Described} */
    const found = { held: new Map(), size: 0, top: new Set() }
    let short = false
    for (const tree of treesOf(char)) {
      const [part, stopped] = evaluate(tree, char, new Set([...path, char]))
      short ||= stopped
      for (const [k, n] of part.held) if (n > (found.held.get(k) ?? 0)) found.held.set(k, n)
      found.size = Math.max(found.size, part.size)
      for (const k of part.top) found.top.add(k)
    }
    // A description cut short by a cycle is not kept, so each kept one is complete.
    if (!short) described.set(char, found)
    return [found, short]
  }
  /** @param {string} char */
  const components = char => { const held = new Map(describe(char, new Set())[0].held); held.delete(fold(char)); return held }

  // Which characters name each component directly, so the characters holding one are found by
  // walking up from it.
  /** @type {Map<string, Set<string>> | null} */
  let users = null
  const usersOf = () => {
    if (users) return users
    users = new Map()
    for (const [char, sequences] of table) for (const text of sequences) for (const token of tokens(text)) {
      if (arity(token) || token === char) continue
      let set = users.get(fold(token))
      if (!set) users.set(fold(token), set = new Set())
      set.add(char)
    }
    return users
  }
  /** Every character holding `part` at any depth. @param {string} part */
  const holders = part => {
    const direct = usersOf(), out = new Set(), queue = [part]
    while (queue.length) for (const char of direct.get(/** @type {string} */ (queue.pop())) ?? []) if (!out.has(char)) { out.add(char); queue.push(fold(char)) }
    out.delete(part)
    return out
  }

  /** 0 for the URO, 1 for the rest of the BMP, 2 beyond it. @param {string} char */
  const tier = char => { const code = /** @type {number} */ (char.codePointAt(0)); return code >= 0x4E00 && code <= 0x9FFF ? 0 : code <= 0xFFFF ? 1 : 2 }
  // How many pieces a character is built from, counted through every level: the same count a full
  // description keeps, worked out without its component maps, since every candidate is sorted by it.
  /** @type {Map<string, number>} */
  const sizes = new Map()
  /** @param {Tree} node @param {string} char @param {Set<string>} path @returns {number} */
  const sizeOfTree = (node, char, path) => {
    const [kind, value] = node
    if (kind === 'leaf') {
      const leaf = /** @type {string} */ (value)
      if (leaf === char || leaf === '？' || unencoded(leaf) !== null || path.has(leaf)) return 1
      return 1 + sizeIn(leaf, path)
    }
    const parts = /** @type {Tree[]} */ (value).map(operand => sizeOfTree(operand, char, path))
    return kind === '㇯' ? Math.max(parts[0] - parts[1], 1) : parts.reduce((sum, n) => sum + n, 0)
  }
  /** @param {string} char @param {Set<string>} path @returns {number} */
  const sizeIn = (char, path) => {
    const kept = sizes.get(char)
    if (kept !== undefined) return kept
    const inner = new Set([...path, char])
    const found = treesOf(char).reduce((most, tree) => Math.max(most, sizeOfTree(tree, char, inner)), 0)
    if (!path.size) sizes.set(char, found)
    return found
  }
  /** @param {string} char */
  const size = char => sizeIn(char, new Set())

  /**
   * The characters holding every part `query` asks for, best first: those holding more of them at
   * their top level, then the everyday ones, then the simpler ones. A query is 2 to PARTS
   * characters; anything else finds nothing.
   * @param {string} query
   * @param {number} [limit]
   * @returns {{ items: string[], more: boolean }}
   */
  function search(query, limit = 24) {
    const chars = [...query.normalize('NFKC')].filter(c => !/\s/u.test(c))
    if (chars.length < 2 || chars.length > PARTS) return { items: [], more: false }
    /** @type {Map<string, number>} */
    const wanted = new Map()
    for (const c of chars) wanted.set(fold(c), (wanted.get(fold(c)) ?? 0) + 1)
    const lists = [...wanted.keys()].map(part => ({ part, n: /** @type {number} */ (wanted.get(part)), chars: holders(part) })).sort((a, b) => a.chars.size - b.chars.size)
    const order = /** @param {string} a @param {string} b */ (a, b) => tier(a) - tier(b) || size(a) - size(b) || /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0))
    const scanned = [...lists[0].chars].sort(order).slice(0, SCAN)
    const found = scanned.filter(char => {
      if (!lists.every(({ chars: set }) => set.has(char))) return false
      const held = components(char)
      return lists.every(({ part, n }) => (held.get(part) ?? 0) >= n)
    })
    /** @param {string} char */
    const direct = char => { const top = describe(char, new Set())[0].top; return [...wanted.keys()].filter(k => top.has(k)).length }
    found.sort((a, b) => direct(b) - direct(a) || order(a, b))
    return { items: found.slice(0, limit), more: found.length > limit }
  }

  return { components, search, size }
}
