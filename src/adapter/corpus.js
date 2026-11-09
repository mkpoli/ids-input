// @ts-check
// The CHISE descriptions in `data/ids-corpus.json.gz`, the merged catalogue in docs/ids-corpus.md.
// The corpus also holds BabelStone's rows; this reader takes only the rows CHISE attests, which the
// adapter merges into the BabelStone table so that one description names every source that gives it.

/** @typedef {import('../core/decompose.js').Sequence} Sequence */

export const CORPUS_FORMAT = 'ids-input/ids-corpus'

/** @param {any} document */
const checkFormat = document => {
  if (document?.format !== CORPUS_FORMAT) throw new Error('Not an ids-corpus document')
  const columns = document.descriptions?.columns
  const rows = document.descriptions?.rows
  if (!Array.isArray(columns) || !Array.isArray(rows)) throw new Error('The corpus has no descriptions table')
  const at = (/** @type {string} */ name) => columns.indexOf(name)
  for (const name of ['subject', 'text', 'prov', 'regions', 'status']) if (at(name) < 0) throw new Error(`The corpus descriptions have no ${name} column`)
  return { rows, at }
}

/**
 * The descriptions CHISE attests, by character. A subject is the corpus's `ucs:XXXX` cid; a row is
 * kept when one of the sources that attest it is a CHISE file, and only when it carries a
 * description (`ready` or `unresolved`); `empty` rows name the character itself and say nothing new.
 * @param {string} text
 * @returns {Map<string, Sequence[]>}
 */
export function readCorpus(text) {
  const document = JSON.parse(text)
  const { rows, at } = checkFormat(document)
  /** @type {string[]} */
  const sources = (document.sources ?? []).map((/** @type {{ id?: string }} */ source) => {
    if (source?.id === 'babelstone') return 'babelstone'
    return /^chise/.test(source?.id ?? '') ? 'chise' : String(source?.id ?? '')
  })
  const subject = at('subject'), textAt = at('text'), prov = at('prov'), regions = at('regions'), status = at('status')
  /** @type {Map<string, Sequence[]>} */
  const table = new Map()
  /** @type {Map<string, number>} */
  const seen = new Map()
  for (const row of rows) {
    const state = row[status]
    if (state !== 'ready' && state !== 'unresolved') continue
    const attested = [...new Set((row[prov] ?? []).map((/** @type {number} */ index) => sources[index]))]
    if (!attested.includes('chise')) continue
    const cid = String(row[subject] ?? '')
    const match = /^ucs:([0-9A-Fa-f]{4,6})$/.exec(cid)
    if (!match) continue
    const char = String.fromCodePoint(parseInt(match[1], 16))
    const written = String(row[textAt] ?? '')
    if (!written) continue
    const region = String(row[regions] ?? '')
    const key = `${char}\0${written}\0${region}`
    const atRow = seen.get(key)
    if (atRow === undefined) {
      const sequences = table.get(char) ?? []
      seen.set(key, sequences.length)
      sequences.push({ text: written, regions: region, sources: attested })
      table.set(char, sequences)
    } else {
      const sequences = table.get(char) ?? []
      const row = sequences[atRow]
      sequences[atRow] = { ...row, sources: [...new Set([...(row.sources ?? []), ...attested])] }
    }
  }
  return table
}
