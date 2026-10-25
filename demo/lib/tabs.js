// The workspace's tabs: one item for each description being edited, kept under `ids-input:tabs`
// with the active tab under `ids-input:activeTab`. A tab holds the text in its field and the text it
// was last saved with, so an edit since then can be marked. The tree itself is in memory only, in
// the editor (see `snapshot` and `restore`).
import { parse, write } from '../../src/core/index.js'
import { load, save } from './storage.js'

/** @typedef {{ id: string, sequence: string, saved: string, whole: string }} Tab */

let made = 0
/** A new tab's id: random where the page may make one, else the time and a count. */
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++made}-${Math.random().toString(36).slice(2, 8)}`

/** `sequence` as the editor writes its tree, `''` when it cannot be read. @param {string} sequence */
const wholeOf = sequence => {
  const read = parse(sequence, { open: true })
  return !read.problem && read.tree !== null ? write(read.tree) : ''
}
/** A tab's text as the editor writes it where it can, else as it was. @param {string} text */
const readable = text => wholeOf(text) || text

/** `sequence` as the editor writes it, for comparing with a tab's text. @param {string} sequence */
export const canonical = sequence => readable(sequence)

/** A new tab over `sequence`, clean against `saved` (the sequence itself by default). @param {string} sequence @param {string} [saved] @returns {Tab} */
export function makeTab(sequence = '', saved = sequence) {
  return { id: newId(), sequence: readable(sequence), saved: readable(saved), whole: wholeOf(sequence) }
}

/** The tabs kept from an earlier visit, oldest first. @returns {Tab[]} */
export function readTabs() {
  const kept = load('tabs', null)
  if (!Array.isArray(kept)) return []
  const seen = new Set()
  return kept.flatMap(item => {
    if (!item || typeof item.id !== 'string' || typeof item.sequence !== 'string' || seen.has(item.id)) return []
    seen.add(item.id)
    const sequence = readable(item.sequence)
    const saved = typeof item.saved === 'string' ? readable(item.saved) : sequence
    return [{ id: item.id, sequence, saved, whole: wholeOf(sequence) }]
  })
}

/** Keep the tabs and the active one for the next visit. @param {Tab[]} tabs @param {string} activeId */
export function writeTabs(tabs, activeId) {
  save('tabs', tabs.map(tab => ({ id: tab.id, sequence: tab.sequence, saved: tab.saved })))
  save('activeTab', activeId)
}

/** The active tab kept from an earlier visit, or null. @returns {string | null} */
export function readActiveTab() {
  const id = load('activeTab', null)
  return typeof id === 'string' ? id : null
}
