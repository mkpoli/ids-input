// @ts-check
// The description search in a Web Worker, so its index is built once off the page's thread. It
// receives `{ id, ids, additionalIds, components, componentsText, forms, formsText, smallSeal, query,
// limit, mode, componentLookup }`: the first message loads the IDS tables and forms; each search
// builds its index when needed. A failed load is tried again on the next message. Each answers
// `{ id, result }` or `{ id, error }`.
import { sealTable, sealForms } from './seal-data.js'
import { createSearch, readStructuralForms } from '../core/search.js'
import { expandNumberedComponents, mergeIdsTables, parseIdsTable, readNumberedComponents, readText } from './babelstone.js'

/** @type {Promise<ReturnType<typeof createSearch>> | null} */
let ready = null
/** A file's response, refused unless it came back whole. @param {string} url */
const get = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response }
/** @param {string} ids @param {string | undefined} additionalIds @param {string | undefined} components @param {string | undefined} componentsText @param {string | undefined} forms @param {string | undefined} given @param {string | import('./seal-data.js').SmallSealData | undefined} smallSeal */
async function load(ids, additionalIds, components, componentsText, forms, given, smallSeal) {
  const [text, extra, numbered, formsText] = await Promise.all([
    get(ids).then(readText),
    additionalIds ? get(additionalIds).then(readText) : '',
    componentsText !== undefined ? componentsText : components ? get(components).then(readText) : '',
    given !== undefined ? given : forms ? get(forms).then(r => r.text()) : '',
  ])
  const doc = typeof smallSeal === 'string' ? JSON.parse(await readText(await get(smallSeal))) : smallSeal
  const parts = readNumberedComponents(numbered)
  const merged = new Map([
    ...mergeIdsTables(expandNumberedComponents(parseIdsTable(text), parts), expandNumberedComponents(parseIdsTable(extra), parts)),
    ...(doc ? sealTable(doc) : []),
  ])
  const table = new Map([...merged].map(([char, sequences]) => [char, sequences.map(s => s.text)]))
  const search = createSearch(table, { forms: sealForms(formsText, doc), structuralForms: readStructuralForms(formsText) })
  return search
}
self.onmessage = async ({ data: { id, ids, additionalIds, components, componentsText, forms, formsText, smallSeal, query, limit, mode, componentLookup } }) => {
  try {
    ready ??= load(ids, additionalIds, components, componentsText, forms, formsText, smallSeal).catch(error => { ready = null; throw error })
    const search = await ready
    self.postMessage({ id, result: mode === 'structure' ? search.structure(query, { limit }) : search.search(query, { limit, componentLookup }) })
  } catch (error) { self.postMessage({ id, error: String(/** @type {Error} */ (error)?.message ?? error) }) }
}
