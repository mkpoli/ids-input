// Drafts kept in this browser, newest first.
import { load, save } from './storage.js'

/** @typedef {{ id: string, sequence: string, saved: number }} Draft */

/** @returns {Draft[]} */
export function drafts() {
  const list = load('drafts', [])
  return Array.isArray(list) ? list.filter(d => d && typeof d.sequence === 'string' && typeof d.id === 'string') : []
}

let made = 0
/** A new draft's id: random where the page may make one, else the time and a count. */
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++made}-${Math.random().toString(36).slice(2, 8)}`

/** Keep `sequence`, once: saving it again moves it to the top. @param {string} sequence @returns {Draft[]} */
export function keep(sequence) {
  const list = [{ id: newId(), sequence, saved: Date.now() }, ...drafts().filter(d => d.sequence !== sequence)].slice(0, 100)
  save('drafts', list)
  return list
}

/** @param {string} id @returns {Draft[]} */
export function forget(id) {
  const list = drafts().filter(d => d.id !== id)
  save('drafts', list)
  return list
}
