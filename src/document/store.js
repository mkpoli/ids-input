// @ts-check
// Persisted editing sessions. A tab or draft keeps the current document, the chosen layer and every
// ID the session has issued, so a reload keeps identity without keeping the in-memory undo history.
// The file format is the document itself (`writeDocument`); this envelope is for host storage.
import { DocumentError, assertDocument, createDocumentSession } from './index.js'
import { inspectJson } from './json.js'

export const SESSION_FORMAT = 'ids-input/session'
export const SESSION_VERSION = 1
const ID = /^[A-Za-z0-9_-]{1,80}$/

/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./session.js').DocumentSession} DocumentSession */
/** @typedef {{ format: string, version: number, document: Document, chosen: string | null, ids: string[] }} SessionRecord */

/** A stored session that cannot be read. */
export class SessionRecordError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'SessionRecordError'
  }
}

/** The record to keep for `session`. It holds no undo history. @param {DocumentSession} session @returns {SessionRecord} */
export function sessionRecord(session) {
  assertDocument(session.document)
  return {
    format: SESSION_FORMAT,
    version: SESSION_VERSION,
    document: /** @type {Document} */ (structuredClone(session.document)),
    chosen: session.chosen,
    ids: [...session.allocator.ids],
  }
}

/** A session record as JSON text, with a trailing newline. @param {DocumentSession} session @param {number} [space] */
export const writeSession = (session, space = 2) => `${JSON.stringify(sessionRecord(session), null, space)}\n`

/** @param {unknown} value @returns {value is string[]} */
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string')

/** A session from an already parsed record. @param {unknown} input @returns {DocumentSession} */
export function sessionFromRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SessionRecordError('a session record must be an object')
  const record = /** @type {Record<string, unknown>} */ (input)
  if (record.format !== SESSION_FORMAT) throw new SessionRecordError(`not an ${SESSION_FORMAT} record`)
  if (record.version !== SESSION_VERSION) throw new SessionRecordError(`unsupported session record version ${String(record.version)}`)
  if (!record.document || typeof record.document !== 'object') throw new SessionRecordError('a session record needs a document')
  if (record.chosen !== null && typeof record.chosen !== 'string') throw new SessionRecordError('a session record needs a chosen ID or null')
  if (!strings(record.ids)) throw new SessionRecordError('a session record needs an array of IDs')
  const bad = record.ids.find(id => !ID.test(id))
  if (bad !== undefined) throw new SessionRecordError(`invalid reserved ID ${bad}`)
  const document = /** @type {Document} */ (record.document)
  try { assertDocument(document) } catch (error) {
    throw new SessionRecordError(error instanceof DocumentError ? (error.issues[0]?.message ?? error.message) : String(error))
  }
  let session
  try { session = createDocumentSession(document, { reserved: record.ids }) } catch (error) {
    throw new SessionRecordError(error instanceof Error ? error.message : String(error))
  }
  if (record.chosen !== null) {
    if (typeof record.chosen !== 'string' || !session.choose(record.chosen)) throw new SessionRecordError(`the chosen layer ${String(record.chosen)} is not in the document`)
  }
  return session
}

/** Read a session record from its JSON text. @param {string} text @returns {DocumentSession} */
export function readSession(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch (error) {
    throw new SessionRecordError(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  let inspected
  try { inspected = inspectJson(text) } catch (error) {
    throw new SessionRecordError(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  const [duplicate] = inspected.duplicateKeys
  if (duplicate) throw new SessionRecordError(`duplicate object key ${duplicate}`)
  const [number] = inspected.numbers
  if (number) throw new SessionRecordError(`number outside finite binary64: ${number}`)
  return sessionFromRecord(parsed)
}
