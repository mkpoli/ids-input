// Drafts kept in this browser, newest first.
import { load, save } from './storage.js'

/** @typedef {{ id: string, sequence: string, saved: number, document?: import('../../src/document/index.js').SessionRecord }} Draft */

/** @returns {Draft[]} */
export function drafts() {
  const list = load('drafts', [])
  return Array.isArray(list) ? list.filter(d => d && typeof d.sequence === 'string' && typeof d.id === 'string')
    .map(d => ({ id: d.id, sequence: d.sequence, saved: d.saved, ...(d.document && typeof d.document === 'object' && !Array.isArray(d.document) ? { document: d.document } : {}) })) : []
}

let made = 0
/** A new draft's id: random where the page may make one, else the time and a count. */
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++made}-${Math.random().toString(36).slice(2, 8)}`

/** Keep `sequence` and its document once: saving the same pair again moves it to the top.
 *  @param {string} sequence @param {Draft['document']} [document] @returns {Draft[]} */
export function keep(sequence, document = undefined) {
  const same = d => d.sequence === sequence && JSON.stringify(d.document ?? null) === JSON.stringify(document ?? null)
  const list = [{ id: newId(), sequence, saved: Date.now(), ...(document ? { document } : {}) }, ...drafts().filter(d => !same(d))].slice(0, 100)
  save('drafts', list)
  return list
}

/** @param {string} id @returns {Draft[]} */
export function forget(id) {
  const list = drafts().filter(d => d.id !== id)
  save('drafts', list)
  return list
}
