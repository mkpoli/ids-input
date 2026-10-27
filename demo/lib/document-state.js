// A document session per open tab. The core editor tree stays the projection the controls edit;
// `syncDocument` reconciles it into the session after every change, keeping layer IDs and transforms.
import { DocumentError, createDocumentSession, emptyDocument, fromSequence, sessionFromRecord, sessionRecord, syncDocument } from '../../src/document/index.js'

/** @typedef {import('../../src/document/index.js').DocumentSession} DocumentSession */
/** @typedef {import('./tabs.js').Tab} Tab */

/** A plain copy of a record held in Svelte state; the proxy itself is not structured-cloneable.
 *  @param {Tab['document']} [record] @returns {Tab['document']} */
export const plain = record => record ? JSON.parse(JSON.stringify(record)) : undefined

/** Open the session kept with `tab`, or start one from its sequence. A malformed record or draft
 *  falls back to an empty document instead of losing the tab. @param {Tab} tab @returns {DocumentSession} */
export function openTabSession(tab) {
  if (tab.document) {
    try { return sessionFromRecord(plain(tab.document)) } catch { /* A stale record is replaced below. */ }
  }
  try { return createDocumentSession(fromSequence(tab.sequence)) } catch (error) {
    if (!(error instanceof DocumentError)) throw error
    return createDocumentSession(emptyDocument())
  }
}

/** Reconcile the editor tree into `session` and return the record to keep with the tab.
 *  @param {DocumentSession} session @param {import('../../src/core/ids.js').Part} tree
 *  @returns {import('../../src/document/index.js').SessionRecord} */
export function syncTabSession(session, tree) {
  const chosen = session.chosen
  const next = syncDocument(session.document, tree, { allocator: session.allocator })
  session.open(next)
  if (chosen) session.choose(chosen)
  return sessionRecord(session)
}
