// @ts-check
// What a component no code point names is, said in another table's notation.
//
// Three tables describe the same characters and each writes its own unencoded parts: BabelStone
// `{53}`, CHISE `&CDP-8BD0;`, zi.tools `#(-𠃌㇉)`. Where one table's description of a character
// names such a part and another table describes the same character down to parts of its own, the
// part is what remains of the second description once the first one's other parts are taken out:
//
//   BabelStone  鸟 = ⿹{53}一
//   zi.tools    鸟 = ⿴乌丶, 乌 = ⿱丿⿹#(-𠃌㇉)一   so 鸟 = ⿴⿱丿⿹#(-𠃌㇉)一丶
//   {53} = 鸟 without 一 = ⿴⿱丿#(-𠃌㇉)丶
//
// Nothing here is asserted by a source: every row is derived, and says from which characters.
import { customsOf, isCustom, isNode, parse, write } from '../../src/core/ids.js'

/** @typedef {import('../../src/core/ids.js').Part} Part */
/** @typedef {Map<string, Part[]>} Table A table's descriptions of each character, the primary one first. */

/** Operators whose result is no arrangement of its parts: the node is one shape of its own. */
const OPAQUE = new Set(['⿾', '⿿', '㇯'])

/** A description as a tree without notes, marks or the variation indicator, or null where it does
 * not read. @param {string} text @returns {Part | null} */
export function plainTree(text) {
  const read = parse(text)
  if (read.problem) {
    // A table may describe a character as one component: 丸 for {20}.
    const lone = parse(text, { open: true })
    return !lone.problem && typeof lone.tree === 'string' ? lone.tree : null
  }
  /** @param {Part} part @returns {Part} */
  const strip = part => !isNode(part) ? part : part.op === '〾' ? strip(part.parts[0]) : { op: part.op, parts: part.parts.map(strip) }
  return strip(read.tree)
}

/** @param {Part} tree @returns {string[]} The components of a tree, an opaque node as one. */
export function atoms(tree) {
  if (tree === null) return []
  if (!isNode(tree)) return [tree]
  if (OPAQUE.has(tree.op)) return [write(tree)]
  return tree.parts.flatMap(atoms)
}

/**
 * A frame: one table read down to its smallest parts.
 * @param {Table} table
 */
export function createFrame(table) {
  /** @type {Map<string, Part>} */
  const memo = new Map()
  /** @param {Part} tree @param {Set<string>} seen @returns {Part} */
  const expand = (tree, seen) => {
    if (tree === null) return null
    if (isNode(tree)) return OPAQUE.has(tree.op) ? write(tree) : { op: tree.op, parts: tree.parts.map(part => expand(part, seen)) }
    if (isCustom(tree) || seen.has(tree)) return tree
    const cached = memo.get(tree)
    if (cached !== undefined && !seen.size) return cached
    const own = table.get(tree)?.[0]
    // A character with no description, or described as itself, is a smallest part.
    const out = own === undefined || !isNode(own) ? tree : expand(own, new Set(seen).add(tree))
    if (!seen.size) memo.set(tree, out)
    return out
  }
  /** @type {Map<string, string> | null} */
  let named = null
  return {
    table,
    /** `tree` with every character replaced by the table's description of it, to the smallest parts.
     * @param {Part} tree @returns {Part} */
    expand: tree => expand(tree, new Set()),
    /** `tree` with each subtree that is the whole of one character written as that character, the
     * largest first. @param {Part} tree @returns {Part} */
    collapse(tree) {
      if (!named) {
        named = new Map()
        for (const [char, [first]] of table) {
          if (!isNode(first)) continue
          const key = write(expand(char, new Set()))
          if (!named.has(key)) named.set(key, char)
        }
      }
      const names = named
      /** @param {Part} part @returns {Part} */
      const fold = part => {
        if (!isNode(part)) return part
        const whole = names.get(write(part))
        return whole ?? { op: part.op, parts: part.parts.map(fold) }
      }
      return fold(tree)
    },
  }
}

/** @param {string[]} list @returns {Map<string, number>} */
const counted = list => { const out = new Map(); for (const item of list) out.set(item, (out.get(item) ?? 0) + 1); return out }

/** Operators for what is left of a three-part operator once one part is gone. */
const NARROWER = /** @type {Record<string, string>} */ ({ '⿲': '⿰', '⿳': '⿱' })

/**
 * `tree` without the components `gone` names, each as many times as it is listed. A node left with
 * one part is that part. Answers null where the tree does not hold them, where a component to take
 * out stands more often than asked (which one is meant is not known), or where nothing is left.
 * @param {Part} tree @param {string[]} gone @returns {Part | null}
 */
export function without(tree, gone) {
  const want = counted(gone), have = counted(atoms(tree))
  for (const [atom, n] of want) if (have.get(atom) !== n) return null
  /** @param {Part} part @returns {Part | undefined} */
  const prune = part => {
    if (part === null) return undefined
    if (!isNode(part) || OPAQUE.has(part.op)) return want.has(isNode(part) ? write(part) : part) ? undefined : part
    const kept = /** @type {Part[]} */ (part.parts.map(prune).filter(kid => kid !== undefined))
    if (!kept.length) return undefined
    if (kept.length === 1) return kept[0]
    return { op: kept.length === part.parts.length ? part.op : NARROWER[part.op] ?? part.op, parts: kept }
  }
  return prune(tree) ?? null
}

/** The parts of `tree` beside the component at `leaf`: every largest subtree that does not hold it.
 * @param {Part} tree @param {string} leaf @returns {Part[]} */
export function besides(tree, leaf) {
  if (!isNode(tree)) return []
  /** @type {Part[]} */
  const out = []
  for (const part of tree.parts) {
    if (atoms(part).includes(leaf)) out.push(...besides(part, leaf))
    else out.push(part)
  }
  return out
}

/**
 * `tree` minus the components `gone`, the subtraction written where it applies: on the smallest
 * part that holds what is taken out, and gone altogether where a whole part is taken out.
 * `holds(part)` answers the smallest parts of one component.
 * @param {Part} tree @param {string[]} gone @param {(part: string) => string[]} holds
 * @param {(atoms: string[]) => Part} named Writes the parts taken out as the source would name them.
 * @returns {Part | null}
 */
export function subtract(tree, gone, holds, named) {
  /** @param {Part} part @returns {string[]} */
  const inside = part => part === null ? [] : isNode(part) && !OPAQUE.has(part.op) ? part.parts.flatMap(inside) : holds(isNode(part) ? write(part) : part)
  const want = counted(gone), have = counted(inside(tree))
  for (const [atom, n] of want) if (have.get(atom) !== n) return null
  /** @param {Part} part @returns {Part | undefined} */
  const walk = part => {
    const mine = inside(part).filter(atom => want.has(atom))
    if (!mine.length) return part
    if (mine.length === inside(part).length) return undefined
    if (!isNode(part) || OPAQUE.has(part.op)) return { op: '㇯', parts: [part, named(mine)] }
    const kept = /** @type {Part[]} */ (part.parts.map(walk).filter(kid => kid !== undefined))
    if (kept.length === 1) return kept[0]
    return { op: kept.length === part.parts.length ? part.op : NARROWER[part.op] ?? part.op, parts: kept }
  }
  return walk(tree) ?? null
}

/**
 * Every custom component of `from` solved in `frame`'s parts.
 *
 * For each character both tables describe, and each description of it in `from` that names exactly
 * one custom component not yet solved, the component is the frame's description of the character
 * without the frame's parts of everything else the description names. A component solved earlier
 * counts as its parts, so the rounds go on until nothing new is found.
 *
 * @param {Table} from @param {ReturnType<typeof createFrame>} frame
 * @returns {Map<string, Map<string, string[]>>} Component, then each expression found for it with
 * the characters that give it.
 */
export function solve(from, frame) {
  /** @type {Map<string, Map<string, string[]>>} */
  const found = new Map()
  /** @type {Map<string, Part>} */
  const best = new Map()
  for (let round = 0; round < 6; round++) {
    let added = 0
    for (const [char, described] of from) {
      const targets = frame.table.get(char)
      if (!targets) continue
      for (const tree of described) {
        const open = [...new Set(customsOf(tree))].filter(custom => !best.has(custom))
        if (open.length !== 1 || atoms(tree).filter(atom => atom === open[0]).length !== 1) continue
        const [custom] = open
        if (found.get(custom)?.size && [...(found.get(custom)?.values() ?? [])].some(chars => chars.includes(char))) continue
        /** @param {Part} part @returns {Part} */
        const known = part => isNode(part) ? { op: part.op, parts: part.parts.map(known) } : best.get(/** @type {string} */ (part)) ?? part
        const gone = besides(tree, custom).flatMap(part => atoms(frame.expand(known(part))))
        for (const target of targets) {
          const rest = without(frame.expand(target), gone)
          if (rest === null) continue
          const text = write(rest)
          const rows = found.get(custom) ?? new Map()
          found.set(custom, rows)
          rows.set(text, [...(rows.get(text) ?? []), char])
          added++
          break
        }
      }
    }
    // The expression most characters give stands for the component in later rounds.
    for (const [custom, rows] of found) {
      if (best.has(custom)) continue
      const [text] = [...rows].sort((a, b) => b[1].length - a[1].length || a[0].length - b[0].length)[0]
      const tree = plainTree(text)
      if (tree !== null) best.set(custom, tree)
    }
    if (!added) break
  }
  return found
}
