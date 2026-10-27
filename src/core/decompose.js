// @ts-check
// Decomposition: the characters or the description typed into "Take parts from", each character's
// descriptions as an adapter gives them, and the way the tree of them is stepped through by keys.
import { isComponent, isDescription, leaves, parse } from './ids.js'
import { emojiPrefix } from './emoji.js'
import { unicodeProperty } from './unicode.js'
import { unalias } from './aliases.js'

/**
 * @typedef {{ text: string, regions?: string }} Sequence A description of a character, with the source regions it describes (`GHTJKPV`).
 * @typedef {{ status: 'loading' } | { status: 'failed' } | { status: 'ready', sequences: Sequence[] }} Entry What is known of a character's descriptions.
 * @typedef {{ kind: 'sequence', text: string, tree: import('./ids.js').Part } | { kind: 'char', char: string }} Root
 */

/** How many characters are decomposed at once. */
export const ROOTS = 8
/** How many characters deep a part can be opened, counting the one typed. */
export const DEPTH = 8
/** The most parts a search for characters containing them takes. */
export const SEARCH_PARTS = 8

const SELECTOR = /^[︀-️\u{E0100}-\u{E01EF}]$/u

/**
 * A description's tokens: an unencoded component written `{n}` (as BabelStone IDS writes them) is
 * one, a variation selector goes with the character before it.
 * @param {string | null | undefined} text
 * @returns {string[]}
 */
export function tokens(text) {
  /** @type {string[]} */
  const out = []
  // A complete description can use braces and digits as literal graphic operands.
  // Otherwise retain BabelStone's unresolved {n} notation as one token.
  const written = text ?? ''
  const complete = isDescription(text)
  let at = 0
  while (at < written.length) {
    const rest = written.slice(at)
    const token = emojiPrefix(rest) || (!complete ? /^\{\d+\}/.exec(rest)?.[0] : '') || [...rest][0]
    at += token.length
    if (SELECTOR.test(token) && out.length) out[out.length - 1] += token
    else out.push(token)
  }
  return out
}

/** The number of an unencoded component `{n}`, or null for any other token. @param {string | null | undefined} token */
export const unencoded = token => /^\{(\d+)\}$/.exec(token ?? '')?.[1] ?? null

/** The character a part is looked up by: its variation selector dropped. @param {string | null | undefined} part */
export const lookupChar = part => [...(part ?? '')][0] ?? ''

/** Whether a part can be looked up: one encoded component, not ？. @param {unknown} part @returns {part is string} */
export const decomposable = part => typeof part === 'string' && unencoded(part) === null && isComponent(lookupChar(part)) && lookupChar(part) !== '？'

/**
 * What is decomposed for the text typed: a description (typed with operators or their ASCII names)
 * as one sequence, else each component character once, in order, at most ROOTS; an ASCII letter
 * or digit only when it is typed alone.
 * @param {string | null | undefined} text
 * @returns {Root[]}
 */
export function roots(text) {
  const written = unalias((text ?? '').trim())
  if (!written) return []
  if (isDescription(written)) return [{ kind: 'sequence', text: written, tree: /** @type {import('./ids.js').Part} */ (parse(written).tree) }]
  const seen = new Set(), typed = tokens(written)
  // An ASCII letter or digit counts only alone: a word names none.
  for (const token of typed) if (decomposable(token) && (typed.length === 1 || !/^[0-9A-Za-z]$/.test(token))) seen.add(token)
  return [...seen].slice(0, ROOTS).map(char => ({ kind: 'char', char }))
}

/**
 * A character's descriptions, once each, in the order given. Each is `{ text, regions, tree }`, the
 * tree null where the sequence cannot be read as a description (one naming an unencoded `{n}`).
 * @param {Entry | undefined} entry
 * @returns {{ text: string, regions: string, tree: import('./ids.js').Part }[]}
 */
export function variants(entry) {
  if (!entry || entry.status !== 'ready') return []
  /** @type {Map<string, string>} */
  const listed = new Map()
  for (const { text, regions } of entry.sequences) {
    if (!text) continue
    // The same sequence given twice keeps every region given.
    const had = listed.get(text)
    listed.set(text, had === undefined ? regions ?? '' : [...new Set([...had, ...(regions ?? '')])].join(''))
  }
  return [...listed].map(([text, regions]) => {
    const read = parse(text)
    return { text, regions, tree: read.problem ? null : /** @type {import('./ids.js').Part} */ (read.tree) }
  })
}

/** The encoded components an unreadable sequence names, once each, so they can still be opened. @param {string} text */
export const namedParts = text => [...new Set(tokens(text).filter(decomposable))]

const PART = /^[\p{Script=Han}\u{17000}-\u{18AFF}\u{18D00}-\u{18DFF}㇀-㇯]$/u
/**
 * The parts a search for characters containing them is asked for: two or more typed characters as
 * they are, else the components of the one typed (of its first readable description), counted, so
 * 林 asks for 木 twice. Only ideographs, radicals and strokes are asked for, at most SEARCH_PARTS;
 * fewer than two ask for nothing (`''`).
 * @param {Root[]} found
 * @param {Record<string, Entry | undefined>} known
 */
export function searchParts(found, known) {
  /** @type {(string | null)[]} */
  let parts
  if (found.length === 1 && found[0].kind === 'sequence') parts = leaves(found[0].tree).map(leaf => leaf.char)
  else if (found.length === 1 && found[0].kind === 'char') {
    const tree = variants(known[lookupChar(found[0].char)]).find(v => v.tree)?.tree
    parts = tree ? leaves(tree).map(leaf => leaf.char) : []
  } else parts = found.map(root => root.kind === 'char' ? root.char : null)
  const asked = parts.filter(part => typeof part === 'string' && (unicodeProperty('ideographic', lookupChar(part)) || PART.test(lookupChar(part).normalize('NFKC')))).map(lookupChar)
  return asked.length >= 2 ? asked.slice(0, SEARCH_PARTS).join('') : ''
}

/**
 * @typedef {{ level: number, open?: boolean, openable?: boolean, swaps?: unknown[] }} TreeRow
 * @typedef {{ focus: number } | { toggle: number } | { swap: number | null }} TreeMove
 */

/**
 * Where a key moves in a tree shown as a list of rows in reading order, from the row `at` (and, with
 * `swap`, from that one of its swaps): ArrowDown and ArrowUp to the next row and the one before, Home
 * and End to the first and last. ArrowRight opens a closed row, else steps through its swaps, then
 * into it when it is open; ArrowLeft steps back through the swaps to the row, then closes an open row
 * or steps out to its parent. Answers `{ focus }` (a row index), `{ toggle }` (the row to open or
 * close), `{ swap }` (a swap's index, null for the row itself), or null for a key the tree leaves alone.
 * @param {TreeRow[]} rows
 * @param {number} at
 * @param {string} key
 * @param {number | null} [swap]
 * @returns {TreeMove | null}
 */
export function treeKey(rows, at, key, swap = null) {
  const row = rows[at]
  if (!row) return null
  const swaps = row.swaps?.length ?? 0
  switch (key) {
    case 'ArrowDown': return { focus: Math.min(at + 1, rows.length - 1) }
    case 'ArrowUp': return { focus: Math.max(at - 1, 0) }
    case 'Home': return { focus: 0 }
    case 'End': return { focus: rows.length - 1 }
    case 'ArrowRight':
      if (row.openable && !row.open) return { toggle: at }
      if ((swap ?? -1) < swaps - 1) return { swap: (swap ?? -1) + 1 }
      if (row.open && (rows[at + 1]?.level ?? 0) > row.level) return { focus: at + 1 }
      return { focus: at }
    case 'ArrowLeft': {
      if (swap !== null) return { swap: swap > 0 ? swap - 1 : null }
      if (row.openable && row.open) return { toggle: at }
      for (let k = at - 1; k >= 0; k--) if (rows[k].level < row.level) return { focus: k }
      return { focus: at }
    }
    default: return null
  }
}
