// Sequences opened in this browser, newest first, for File -> Recent. A sequence opened again moves
// to the top with its latest document; the list is capped so it stays short.
import { EMPTY_MARKS } from '../../src/core/index.js'
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
    const text = typeof sequence === 'string' ? sequence.trim() : ''
    if (!text || EMPTY_MARKS.includes(text) || seen.has(text)) return []
    seen.add(text)
    // A stored record whose document does not look like one keeps its sequence but not the record.
    const record = item && typeof item === 'object' ? item : {}
    const document = record.document && typeof record.document === 'object'
      && record.document.document && typeof record.document.document === 'object'
      ? /** @type {Recent['document']} */ (record.document)
      : undefined
    return [{ sequence: text, ...(document ? { document } : {}) }]
  }).slice(0, MAX)
}

/** Move `sequence` to the top of the recent list, with `document` when it has one. @param {string} sequence @param {Recent['document']} [document] @returns {Recent[]} */
export function remember(sequence, document = undefined) {
  const text = sequence.trim()
  if (!text || EMPTY_MARKS.includes(text)) return readRecent()
  const entry = { sequence: text, ...(document ? { document: JSON.parse(JSON.stringify(document)) } : {}) }
  const list = [entry, ...readRecent().filter(item => item.sequence !== text)].slice(0, MAX)
  save('recent', list)
  return list
}
