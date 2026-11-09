// @ts-check
// The description search in a Web Worker, so its index is built once off the page's thread. It
// receives `{ id, ids, zitools, chise, project, components, componentsText, forms, formsText, layers, layersText, smallSeal, shuishu, jurchen,
// query, limit, mode, componentLookup }`: the first message loads the IDS tables and forms; each search
// builds its index when needed. A failed load is tried again on the next message. Each answers
// `{ id, result }` or `{ id, error }`.
import { sealTable, sealForms } from './seal-data.js'
import { shuishuSequences } from './shuishu-data.js'
import { jurchenSequences } from './jurchen-data.js'
import { createSearch, readStructuralForms } from '../core/search.js'
import { expandNumberedComponents, mergeIdsTables, parseIdsTable, parseLayers, readNumberedComponents, readText } from './babelstone.js'
import { readCorpus } from './corpus.js'
import { download } from '@han-compose/composer/retry'

/** @type {Promise<ReturnType<typeof createSearch>> | null} */
let ready = null
/** A file's response, refused unless it came back whole. @param {string} url */
const get = async url => { const response = await download(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response }
/** The optional files the index was built without, retried before the next answer.
 * @type {{ url: string, read: (doc: any) => unknown }[]} */
let lost = []
/** A decomposition file's contents. @param {string} url */
const readOptional = url => get(url).then(readText).then(JSON.parse)
/** The file's contents, or nothing and a note to try again. @param {string} url @param {(doc: any) => unknown} read */
const optional = (url, read) => readOptional(url).then(doc => (read(doc), doc)).catch(() => { lost.push({ url, read }); return undefined })
/** Whether a file the index was built without can now be read, so the index should be rebuilt. */
export async function recovered() {
  const back = await Promise.all(lost.map(({ url, read }) => readOptional(url).then(doc => (read(doc), true), () => false)))
  return back.some(Boolean)
}

/** @param {{ ids: string, zitools?: string, chise?: string, project?: string, components?: string, componentsText?: string,
 *   forms?: string, formsText?: string, layers?: string, layersText?: string,
 *   smallSeal?: string | import('./seal-data.js').SmallSealData,
 *   shuishu?: string | import('./shuishu-data.js').ShuishuData,
 *   jurchen?: string | import('./jurchen-data.js').JurchenData }} files */
export async function load({ ids, zitools, chise, project, components, componentsText, forms, formsText, layers, layersText, smallSeal, shuishu, jurchen }) {
  const [text, fromZitools, fromChise, fromProject, numbered, formText, layerText] = await Promise.all([
    get(ids).then(readText),
    zitools ? get(zitools).then(readText) : null,
    chise ? get(chise).then(readText) : null,
    project ? get(project).then(readText) : null,
    componentsText !== undefined ? componentsText : components ? get(components).then(readText) : '',
    formsText !== undefined ? formsText : forms ? get(forms).then(r => r.text()) : '',
    // Layers are an extra reading; a failed file leaves the source search standing.
    layersText !== undefined ? layersText : layers ? get(layers).then(readText).catch(() => '') : '',
  ])
  const doc = typeof smallSeal === 'string' ? JSON.parse(await readText(await get(smallSeal))) : smallSeal
  // The Shuishu and Jurchen decompositions are editorial and run beside the sources; a failed file
  // costs the search those descriptions only.
  lost = []
  const shuiDoc = typeof shuishu === 'string' ? await optional(shuishu, shuishuSequences) : shuishu
  const jurDoc = typeof jurchen === 'string' ? await optional(jurchen, jurchenSequences) : jurchen
  const parts = readNumberedComponents(numbered)
  let merged = expandNumberedComponents(parseIdsTable(text, 'babelstone'), parts)
  for (const [extra, source] of [[fromZitools, 'zitools'], [fromProject, 'project']]) {
    if (extra) merged = mergeIdsTables(merged, expandNumberedComponents(parseIdsTable(/** @type {string} */ (extra), /** @type {string} */ (source)), parts))
  }
  if (fromChise) merged = mergeIdsTables(merged, readCorpus(/** @type {string} */ (fromChise)))
  if (doc) for (const [char, sequences] of sealTable(doc)) merged.set(char, sequences)
  try {
    if (shuiDoc) for (const [char, sequences] of shuishuSequences(shuiDoc)) {
      const had = merged.get(char) ?? []
      merged.set(char, [...had, ...sequences.filter(own => !had.some(sequence => sequence.text === own.text))])
    }
  } catch { /* An unreadable decomposition file leaves the sources standing. */ }
  try {
    if (jurDoc) for (const [char, sequences] of jurchenSequences(jurDoc)) {
      const had = merged.get(char) ?? []
      merged.set(char, [...had, ...sequences.filter(own => !had.some(sequence => sequence.text === own.text))])
    }
  } catch { /* An unreadable decomposition file leaves the sources standing. */ }
  const table = new Map([...merged].map(([char, sequences]) => [char, sequences.map(s => s.text)]))
  // A derived reading is an alternative description, so a layered sequence finds its character.
  let layerMap = new Map()
  try { layerMap = parseLayers(layerText) } catch { /* The optional file may be malformed. */ }
  for (const [char, sequence] of layerMap) {
    const texts = table.get(char) ?? []
    if (!texts.includes(sequence)) table.set(char, [sequence, ...texts])
  }
  const search = createSearch(table, { forms: sealForms(formText, doc), structuralForms: readStructuralForms(formText) })
  return search
}
self.onmessage = async ({ data: { id, ids, zitools, chise, project, components, componentsText, forms, formsText, layers, layersText, smallSeal, shuishu, jurchen, query, limit, mode, componentLookup } }) => {
  try {
    if (ready && lost.length && await recovered()) ready = null
    ready ??= load({ ids, zitools, chise, project, components, componentsText, forms, formsText, layers, layersText, smallSeal, shuishu, jurchen }).catch(error => { ready = null; throw error })
    const search = await ready
    self.postMessage({ id, result: mode === 'structure' ? search.structure(query, { limit })
      : mode === 'unknown' ? search.unknownStructure(query, { limit })
      : mode === 'similar' ? search.similar(query, { limit })
      : search.search(query, { limit, componentLookup }) })
  } catch (error) { self.postMessage({ id, error: String(/** @type {Error} */ (error)?.message ?? error) }) }
}
