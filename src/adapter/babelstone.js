// @ts-check
// The default adapter: BabelStone IDS from a compact table, and the parts palette, read from URLs the
// host serves (both ship in this package's `data/`). Nothing is asked of a server beyond the two files.
import { componentIndex } from './containing.js'
import { createSearch, readForms } from '../core/search.js'
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
export async function readText(response) {
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
 * `table` and `palette` hand the data over directly instead. `forms` is the URL of
 * `data/component-forms.tsv` (or `formsText` its text), which the description search folds
 * components by. The description search (`findByIds`) runs in a Web Worker made by `worker` where
 * there is one, its index built there once; elsewhere it runs on the caller's thread.
 * @param {{ ids?: string | URL, parts?: string | URL, forms?: string | URL, formsText?: string, table?: Map<string, Sequence[]>, palette?: PalettePart[], fetch?: typeof fetch,
 *   worker?: (() => Worker) | null }} options
 * @returns {IdsAdapter & { table: () => Promise<Map<string, Sequence[]>> }}
 */
export function babelStoneAdapter({ ids, parts, forms, formsText, table: given, palette: givenPalette, fetch: get = globalThis.fetch.bind(globalThis),
  worker = typeof Worker === 'undefined' || !ids ? null : () => new Worker(new URL('./search-worker.js', import.meta.url), { type: 'module' }) } = {}) {
  /** @type {Promise<Map<string, Sequence[]>> | null} */
  let table = given ? Promise.resolve(given) : null
  /** @type {Promise<PalettePart[]> | null} */
  let palette = givenPalette ? Promise.resolve(givenPalette) : null
  /** @type {ReturnType<typeof componentIndex> | null} */
  let index = null
  /** @type {Promise<Map<string, string[]>> | null} */
  let described = null
  /** @type {Promise<ReturnType<typeof createSearch>> | null} */
  let local = null
  /** @type {Worker | null} */
  let searcher = null
  /** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
  const asked = new Map()
  let asks = 0
  /** The description search on this thread, over the table and the forms. */
  const localSearch = () => local ??= Promise.all([read(), formsText !== undefined ? formsText : forms ? load(forms).then(r => r.text()) : '']).then(([found, text]) =>
    createSearch(new Map([...found].map(([char, sequences]) => [char, sequences.map(s => s.text)])), { forms: readForms(text) })).catch(error => { local = null; throw error })
  /** The description search in the worker, which loads the files itself. @param {string} query @param {number} limit */
  function inWorker(query, limit) {
    if (!searcher && worker) {
      searcher = worker()
      searcher.onmessage = ({ data }) => {
        const waiting = asked.get(data.id)
        asked.delete(data.id)
        if (data.error === undefined) waiting?.resolve(data.result); else waiting?.reject(new Error(data.error))
      }
      // A worker that cannot start or answer fails everything asked of it, and the next ask starts another.
      /** @param {Event} event */
      const failed = event => {
        event.preventDefault()
        searcher?.terminate()
        searcher = null
        for (const waiting of asked.values()) waiting.reject(new Error('The search worker failed.'))
        asked.clear()
      }
      searcher.onerror = failed
      searcher.onmessageerror = failed
    }
    const id = ++asks, base = globalThis.location?.href
    return new Promise((resolve, reject) => {
      asked.set(id, { resolve, reject })
      searcher?.postMessage({ id, query, limit, ids: new URL(String(ids), base).href, forms: forms ? new URL(String(forms), base).href : undefined, formsText })
    })
  }

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
      // An ASCII letter or digit counts only alone: a word or a code point's digits names none.
      const rest = [...text.replace(/[Uu]\+[0-9A-Fa-f]{4,6}/g, '')]
      for (const char of rest) if (isComponent(char) && (rest.length === 1 || !/[0-9A-Za-z]/.test(char))) chars.push(char)
      return [...new Set(chars)].filter(isComponent).map(char => ({ char, label: codePoint(char) }))
    },
    async encoded(sequence) {
      // Built once from the table; a failed load is tried again on the next call.
      described ??= read().then(found => {
        /** @type {Map<string, string[]>} */
        const by = new Map()
        for (const [char, sequences] of found) for (const { text } of sequences) {
          if (!isSequence(text)) continue
          const chars = by.get(text)
          if (chars) { if (!chars.includes(char)) chars.push(char) } else by.set(text, [char])
        }
        return by
      }).catch(error => { described = null; throw error })
      return (await described).get(sequence.trim()) ?? []
    },
    async findByIds(query, { limit = 60, signal } = {}) {
      const result = worker && !given ? await inWorker(query, limit) : (await localSearch()).search(query, { limit })
      signal?.throwIfAborted()
      return result
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
