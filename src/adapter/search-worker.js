// @ts-check
// The description search in a Web Worker, so its index is built once off the page's thread. It
// receives `{ id, ids, forms, formsText, smallSeal, query, limit }`: the first message loads the table at `ids`
// and the forms at `forms` (or takes `formsText`) and builds the index; a failed load is tried again
// on the next message. Each answers `{ id, result }` or `{ id, error }`.
import { sealTable, sealForms } from './seal-data.js'
import { createSearch } from '../core/search.js'
import { parseIdsTable, readText } from './babelstone.js'

/** @type {Promise<ReturnType<typeof createSearch>> | null} */
let ready = null
/** A file's response, refused unless it came back whole. @param {string} url */
const get = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response }
/** @param {string} ids @param {string | undefined} forms @param {string | undefined} given @param {string | import('./seal-data.js').SmallSealData | undefined} smallSeal */
async function load(ids, forms, given, smallSeal) {
  const [text, formsText] = await Promise.all([get(ids).then(readText), given !== undefined ? given : forms ? get(forms).then(r => r.text()) : ''])
  const doc = typeof smallSeal === 'string' ? JSON.parse(await readText(await get(smallSeal))) : smallSeal
  const merged = new Map([...parseIdsTable(text), ...(doc ? sealTable(doc) : [])])
  const table = new Map([...merged].map(([char, sequences]) => [char, sequences.map(s => s.text)]))
  const search = createSearch(table, { forms: sealForms(formsText, doc) })
  search.index()
  return search
}
self.onmessage = async ({ data: { id, ids, forms, formsText, smallSeal, query, limit } }) => {
  try {
    ready ??= load(ids, forms, formsText, smallSeal).catch(error => { ready = null; throw error })
    const search = await ready
    self.postMessage({ id, result: search.search(query, { limit }) })
  } catch (error) { self.postMessage({ id, error: String(/** @type {Error} */ (error)?.message ?? error) }) }
}
