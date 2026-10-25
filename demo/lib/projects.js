// Drafts saved per viewer: each a sequence with the time it was saved, the newest first. They can be
// written to a text file, one sequence a line, and read back from one.
import { load, save } from './storage.js'

/** @typedef {{ id: string, sequence: string, saved: number }} Draft */

/** @returns {Draft[]} */
export function drafts() {
  const list = load('drafts', [])
  return Array.isArray(list) ? list.filter(d => d && typeof d.sequence === 'string' && typeof d.id === 'string') : []
}

/** Keep `sequence`, once: saving it again moves it to the top. @param {string} sequence @returns {Draft[]} */
export function keep(sequence) {
  const list = [{ id: crypto.randomUUID?.() ?? String(Date.now()), sequence, saved: Date.now() }, ...drafts().filter(d => d.sequence !== sequence)].slice(0, 100)
  save('drafts', list)
  return list
}

/** @param {string} id @returns {Draft[]} */
export function forget(id) {
  const list = drafts().filter(d => d.id !== id)
  save('drafts', list)
  return list
}

/** Drafts as a text file's contents, one sequence a line. @param {Draft[]} list */
export const toText = list => list.map(d => d.sequence).join('\n') + '\n'

/** The sequences of a text file, one a line, blank lines and `#` comments left out. @param {string} text */
export const fromText = text => text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))
