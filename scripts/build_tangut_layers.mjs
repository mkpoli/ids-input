// The largest character split of every Tangut description in `data/babelstone-ids.tsv.gz`.
//
// BabelStone describes every Tangut ideograph as a tree of Tangut components. Components are the
// script's radicals, so the tree is one layer deep, while the same components often spell another
// ideograph whole. This builder rewrites each description top-down: a maximal proper subtree whose
// text is another Tangut ideograph's complete description becomes that ideograph, and a component
// whose glyph is a single-component ideograph becomes that ideograph. The editor opens the
// ideograph's own layered description in turn, so a character built from characters reads as one.
//
// Only rewritten descriptions are written; a character with no character-sized part keeps its
// BabelStone description as it is. The source stays in `babelstone-ids.tsv.gz`; this file is an
// editorial reading of its shapes, not a claim of descent or of a segmentation the source records.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { isComponent, isNode, parse, write } from '../src/core/ids.js'
import { parseIdsTable } from '../src/adapter/babelstone.js'

/** The Tangut ideograph blocks the table describes; components are its parts, not its rows. */
const TANGUT = /[\u{17000}-\u{187FF}\u{18D00}-\u{18DFF}]/u

/**
 * The table's Tangut descriptions, their characters, and rejected rows.
 * @param {Map<string, { text: string }[]>} table
 */
export function tangutTrees(table) {
  /** @type {Map<string, { text: string, tree: import('../src/core/ids.js').Part }>} */
  const trees = new Map()
  /** @type {string[]} */
  const rejected = []
  for (const [char, sequences] of table) {
    if (!TANGUT.test(char)) continue
    const found = sequences.map(({ text }) => ({ text, read: [...text].length === 1 && isComponent(text) ? { tree: text } : parse(text) })).find(({ read }) => !read.problem)
    if (!found) { rejected.push(char); continue }
    trees.set(char, { text: found.text, tree: /** @type {import('../src/core/ids.js').Part} */ (found.read.tree) })
  }
  return { trees, rejected }
}

/**
 * The characters whose complete description is `text`, in code point order.
 * @param {Map<string, { text: string }>} trees
 */
export function charactersByDescription(trees) {
  /** @type {Map<string, string[]>} */
  const byText = new Map()
  for (const [char, { text }] of trees) {
    const chars = byText.get(text)
    if (chars) chars.push(char); else byText.set(text, [char])
  }
  for (const chars of byText.values()) chars.sort((a, b) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0)))
  return byText
}

/**
 * A node rewritten to the largest ideographs that describe it, or `self` where none does.
 * The root is kept, so a description never becomes the character it describes.
 * @param {import('../src/core/ids.js').Part} node
 * @param {string} self
 * @param {Map<string, string[]>} byText
 * @param {boolean} [root]
 * @returns {import('../src/core/ids.js').Part}
 */
function rewrite(node, self, byText, root = true) {
  const pick = (/** @type {string} */ text) => {
    const chars = byText.get(text)
    return chars?.find(char => char !== self) ?? null
  }
  if (typeof node === 'string') return root ? node : pick(node) ?? node
  if (!root) {
    const found = pick(write(node))
    if (found) return found
  }
  return { op: node.op, parts: node.parts.map(part => rewrite(part, self, byText, false)) }
}

/**
 * The one-step layered description of every Tangut ideograph that has a character-sized part.
 * @param {Map<string, { text: string }[]>} table
 */
export function tangutLayers(table) {
  const { trees, rejected } = tangutTrees(table)
  const byText = charactersByDescription(trees)
  const chars = new Set(trees.keys())
  /** @type {Map<string, string>} */
  const layers = new Map()
  /** @type {Record<string, string[]>} */
  const ambiguous = {}
  let direct = 0, single = 0
  for (const [text, found] of byText) if (found.length > 1) ambiguous[text] = found
  for (const [char, { text, tree }] of trees) {
    if (!isNode(tree)) { single++; continue }
    const layered = rewrite(tree, char, byText)
    const written = write(layered)
    if (written === text) continue
    const read = parse(written)
    if (read.problem) throw new Error(`Layered description of ${char} does not parse: ${written}`)
    layers.set(char, written)
    if (isNode(layered) && layered.parts.some(part => typeof part === 'string' && chars.has(part))) direct++
  }
  return { layers, trees, rejected, ambiguous, direct, single }
}

/** The first line of the table names its source. @param {string} text */
const sourceLine = text => text.split('\n', 1)[0].replace(/^#\s*/, '')

export function build(root = new URL('../', import.meta.url)) {
  const tablePath = new URL('data/babelstone-ids.tsv.gz', root)
  const tableText = gunzipSync(readFileSync(tablePath)).toString()
  const table = parseIdsTable(tableText)
  const { layers, trees, rejected, ambiguous, direct, single } = tangutLayers(table)
  const sourceCharacters = [...table.keys()].filter(char => TANGUT.test(char)).length
  const characters = Object.fromEntries([...layers].sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0))))
  const doc = {
    source: sourceLine(tableText),
    method: 'A maximal proper subtree whose text is another Tangut ideograph\'s complete BabelStone description becomes that ideograph; a component whose glyph is a single-component ideograph becomes that ideograph. The root is kept. Only rewritten descriptions are listed.',
    counts: {
      characters: sourceCharacters,
      parsed: trees.size,
      rejected: rejected.length,
      layered: layers.size,
      direct,
      single,
      ambiguous: Object.keys(ambiguous).length,
    },
    characters,
    ambiguous,
  }
  writeFileSync(new URL('data/tangut-layers.json.gz', root), gzipSync(JSON.stringify(doc) + '\n', { level: 9, mtime: 0 }))
  console.log(JSON.stringify({ ...doc.counts, bytes: readFileSync(new URL('data/tangut-layers.json.gz', root)).length }, null, 2))
  return doc
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build()
