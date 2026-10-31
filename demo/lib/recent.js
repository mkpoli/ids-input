// Sequences opened in this browser, newest first, for File -> Recent. A sequence opened again moves
// to the top with its latest document; the list is capped so it stays short.
import { load, save } from './storage.js'

const MAX = 12

/** @typedef {{ sequence: string, document?: import('../../src/document/index.js').SessionRecord }} Recent */

/** The recent entries, newest first. @returns {Recent[]} */
export function readRecent() {
  const kept = load('recent', [])
  if (!Array.isArray(kept)) return []
  const seen = new Set()
  return kept.flatMap(item => {
    const sequence = typeof item === 'string' ? item : item?.sequence
    if (typeof sequence !== 'string' || !sequence.trim() || sequence === '⬚' || seen.has(sequence)) return []
    seen.add(sequence)
    const document = item && typeof item === 'object' && item.document && typeof item.document === 'object'
      ? /** @type {Recent['document']} */ (item.document)
      : undefined
    return [{ sequence, ...(document ? { document } : {}) }]
  }).slice(0, MAX)
}

/** Move `sequence` to the top of the recent list, with `document` when it has one. @param {string} sequence @param {Recent['document']} [document] @returns {Recent[]} */
export function remember(sequence, document = undefined) {
  const text = sequence.trim()
  if (!text || text === '⬚') return readRecent()
  const entry = { sequence: text, ...(document ? { document: JSON.parse(JSON.stringify(document)) } : {}) }
  const list = [entry, ...readRecent().filter(item => item.sequence !== text)].slice(0, MAX)
  save('recent', list)
  return list
}
