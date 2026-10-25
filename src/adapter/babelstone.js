// @ts-check
// The default adapter: BabelStone IDS from a compact table, and the parts palette, read from URLs the
// host serves (both ship in this package's `data/`). Nothing is asked of a server beyond the two files.
import { componentIndex } from './containing.js'
import { isComponent, isSequence } from '../core/ids.js'

/**
 * @typedef {import('./types.js').IdsAdapter} IdsAdapter
 * @typedef {import('./types.js').PalettePart} PalettePart
 * @typedef {import('../core/decompose.js').Sequence} Sequence
 */

const REGIONS = /\(([^)]*)\)$/

/**
 * The table `data/babelstone-ids.tsv.gz` holds, once decompressed: char → its descriptions with
 * their source regions. Lines starting with `#` are its header.
 * @param {string} text
 * @returns {Map<string, Sequence[]>}
 */
export function parseIdsTable(text) {
  /** @type {Map<string, Sequence[]>} */
  const table = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    table.set(line.slice(0, tab), line.slice(tab + 1).split(' ').filter(Boolean).map(written => {
      const match = REGIONS.exec(written)
      return match ? { text: written.slice(0, match.index), regions: match[1] } : { text: written, regions: '' }
    }))
  }
  return table
}

/**
 * The palette file's rows as objects.
 * @param {{ columns: string[], parts: unknown[][] }} document
 * @returns {PalettePart[]}
 */
export const paletteRows = ({ columns, parts }) => parts.map(row => /** @type {PalettePart} */ (Object.fromEntries(columns.map((name, i) => [name, row[i]]))))

/**
 * A response's text, gunzipped when it is a gzip file served as it is (as GitHub Pages serves a
 * `.gz`); a server that sent it with `Content-Encoding: gzip` has already decoded it.
 * @param {Response} response
 */
async function readText(response) {
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** @param {string} char */
const codePoint = char => `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`

/**
 * An adapter over BabelStone IDS. `ids` is the URL of `data/babelstone-ids.tsv.gz` (or of the same
 * table uncompressed), `parts` of `data/ids-parts.json`; each is fetched once, when first needed.
 * `table` and `palette` hand the data over directly instead.
 * @param {{ ids?: string | URL, parts?: string | URL, table?: Map<string, Sequence[]>, palette?: PalettePart[], fetch?: typeof fetch }} options
 * @returns {IdsAdapter & { table: () => Promise<Map<string, Sequence[]>> }}
 */
export function babelStoneAdapter({ ids, parts, table: given, palette: givenPalette, fetch: get = globalThis.fetch.bind(globalThis) } = {}) {
  /** @type {Promise<Map<string, Sequence[]>> | null} */
  let table = given ? Promise.resolve(given) : null
  /** @type {Promise<PalettePart[]> | null} */
  let palette = givenPalette ? Promise.resolve(givenPalette) : null
  /** @type {ReturnType<typeof componentIndex> | null} */
  let index = null
  /** @type {Map<string, string[]> | null} */
  let described = null

  /** @param {string | URL} url */
  const load = async url => {
    const response = await get(url)
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    return response
  }
  const read = () => table ??= (ids
    ? load(ids).then(readText).then(parseIdsTable)
    : Promise.reject(new Error('babelStoneAdapter: no `ids` URL or `table` given'))
  ).catch(error => { table = null; throw error })

  return {
    table: read,
    async structure(char) {
      const found = (await read()).get(char) ?? []
      // A sequence with no operator names the character itself: it has no smaller parts.
      return found.filter(sequence => isSequence(sequence.text))
    },
    async search(query) {
      const text = query.trim()
      /** @type {string[]} */
      const chars = []
      // A code point written U+4E00, or as bare hex (with a digit) when that is all there is.
      const hex = /^(?=.*\d)[0-9A-Fa-f]{4,6}$/.test(text) ? [text] : [...text.matchAll(/[Uu]\+([0-9A-Fa-f]{4,6})/g)].map(match => match[1])
      for (const value of hex) { const code = parseInt(value, 16); if (code <= 0x10FFFF) chars.push(String.fromCodePoint(code)) }
      for (const char of text.replace(/[Uu]\+[0-9A-Fa-f]{4,6}/g, '')) if (isComponent(char)) chars.push(char)
      return [...new Set(chars)].filter(isComponent).map(char => ({ char, label: codePoint(char) }))
    },
    async encoded(sequence) {
      if (!described) {
        described = new Map()
        for (const [char, sequences] of await read()) for (const { text } of sequences) {
          if (!isSequence(text)) continue
          const chars = described.get(text)
          if (chars) { if (!chars.includes(char)) chars.push(char) } else described.set(text, [char])
        }
      }
      return described.get(sequence.trim()) ?? []
    },
    async containing(asked, { limit = 24 } = {}) {
      index ??= componentIndex(new Map([...(await read())].map(([char, sequences]) => [char, sequences.map(s => s.text)])))
      return index.search(asked, limit)
    },
    parts: () => palette ??= (parts
      ? load(parts).then(response => response.json()).then(paletteRows)
      : Promise.reject(new Error('babelStoneAdapter: no `parts` URL or `palette` given'))
    ).catch(error => { palette = null; throw error }),
  }
}
