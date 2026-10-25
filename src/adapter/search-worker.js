// @ts-check
// The description search in a Web Worker, so its index is built once off the page's thread. It
// receives `{ id, ids, forms, query, limit }`: the first message loads the table at `ids` and the
// forms at `forms` and builds the index; each answers `{ id, result }` or `{ id, error }`.
import { createSearch, readForms } from '../core/search.js'
import { parseIdsTable, readText } from './babelstone.js'

/** @type {Promise<ReturnType<typeof createSearch>> | null} */
let ready = null
/** @param {string} ids @param {string | undefined} forms */
async function load(ids, forms) {
  const [text, formsText] = await Promise.all([fetch(ids).then(readText), forms ? fetch(forms).then(r => r.ok ? r.text() : '') : ''])
  const table = new Map([...parseIdsTable(text)].map(([char, sequences]) => [char, sequences.map(s => s.text)]))
  const search = createSearch(table, { forms: readForms(formsText) })
  search.index()
  return search
}
self.onmessage = async ({ data: { id, ids, forms, query, limit } }) => {
  try {
    ready ??= load(ids, forms).catch(error => { ready = null; throw error })
    const search = await ready
    self.postMessage({ id, result: search.search(query, { limit }) })
  } catch (error) { self.postMessage({ id, error: String(/** @type {Error} */ (error)?.message ?? error) }) }
}
