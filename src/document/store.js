// @ts-check
// Persisted editing sessions. A tab or draft keeps the current document, the chosen layer and every
// ID the session has issued, so a reload keeps identity without keeping the in-memory undo history.
// The file format is the document itself (`writeDocument`); this envelope is for host storage.
import { DocumentError, allocatorFor, assertDocument, createDocumentSession, fromSequence, readDocument, toSequence, writeDocument } from './index.js'
import { inspectJson } from './json.js'

export const SESSION_FORMAT = 'ids-input/session'
export const SESSION_VERSION = 1
const ID = /^[A-Za-z0-9_-]{1,80}$/

/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').Node} Node */
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
/** @param {unknown} value @returns {value is Record<string, any>} */
const object = value => typeof value === 'object' && value !== null && !Array.isArray(value)

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

// ---------------------------------------------------------------- share tokens
//
// A token holds only what its sequence cannot: the title, the rendering recipe and each layer's
// name, transform and extensions, addressed by its path in the tree. The sequence travels in the
// token as well as in the fragment, since the fragment is the part of a URL that gets stripped.
// Layer IDs are fresh on arrival, from the same allocator every time; a group, the one node a
// sequence cannot spell, is written as the kind of its path. A document's timestamps stay behind,
// a share not being a file. An older token, a base64url document whose JSON carries `format`,
// still reads, since such links are already in the wild.

export const SHARE_VERSION = 1
const GROUP = 'g'

/** Whether `document` holds anything a link's fragment cannot carry. @param {Document} document */
export function carriedMore(document) {
  if (document.title !== undefined || document.render.mode !== 'unbound') return true
  if (document.extensions !== undefined) return true
  if (document.geometryEdits?.length) return true
  /** @param {Node} node @returns {boolean} */
  const walk = node => {
    if (node.kind === 'group' || node.name !== undefined || node.transform !== undefined || node.extensions !== undefined) return true
    return node.kind === 'operator' && node.children.some(walk)
  }
  return walk(document.root)
}

/** The path a layer is addressed by: operator children by index, a group child by `g`, joined by dots. */
const childPath = (/** @type {string} */ path, /** @type {string} */ segment) => (path ? `${path}.${segment}` : segment)

/** The path of every layer, and the layer, in tree order. @param {Node} root */
function pathOf(root) {
  /** @type {Map<string, Node>} */
  const found = new Map()
  /** @param {Node} node @param {string} path */
  const walk = (node, path) => {
    found.set(path, node)
    if (node.kind === 'operator') node.children.forEach((child, i) => walk(child, childPath(path, String(i))))
    else if (node.kind === 'group') walk(node.child, childPath(path, GROUP))
  }
  walk(root, '')
  return found
}

/** Base64url of `text`. @param {string} text */
function encode(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The text a base64url token carries. @param {string} token */
function decode(token) {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - token.length % 4) % 4)
  return new TextDecoder().decode(Uint8Array.from(atob(padded), char => char.charCodeAt(0)))
}

/** The share token for `document`: its difference from the sequence, or '' when it has none. @param {Document} document */
export function shareDocument(document) {
  if (!carriedMore(document)) return ''
  /** @type {Record<string, unknown>} */
  const token = { v: SHARE_VERSION, s: toSequence(document.root) }
  if (document.title !== undefined) token.t = document.title
  if (document.render.mode !== 'unbound') token.r = document.render
  if (document.extensions !== undefined) token.e = document.extensions
  const nodes = pathOf(document.root)
  /** @type {[string, Record<string, unknown>][]} */
  const layers = []
  for (const [path, node] of nodes) {
    /** @type {Record<string, unknown>} */
    const fields = {}
    if (node.kind === 'group') fields.k = GROUP
    if (node.name !== undefined) fields.n = node.name
    if (node.transform !== undefined) fields.x = node.transform
    if (node.extensions !== undefined) fields.e = node.extensions
    if (Object.keys(fields).length) layers.push([path, fields])
  }
  if (layers.length) token.l = layers
  if (document.geometryEdits?.length) {
    const paths = new Map([...nodes].map(([path, node]) => [node.id, path]))
    token.g = document.geometryEdits.map(edit => ({ ...edit, node: paths.get(edit.node) ?? edit.node }))
  }
  return encode(JSON.stringify(token))
}

/** A document from a share token. @param {string} token @returns {Document} */
export function readShareDocument(token) {
  const text = decode(token)
  let parsed
  try { parsed = JSON.parse(text) } catch (error) {
    throw new DocumentError([{ path: '', message: `invalid share token: ${error instanceof Error ? error.message : error}` }])
  }
  if (!object(parsed)) throw new DocumentError([{ path: '', message: 'a share token is an object' }])
  // A token from before the difference format holds a whole document.
  if (typeof (/** @type {Record<string, unknown>} */ (parsed).format) === 'string') return readDocument(text)
  const token_ = /** @type {Record<string, any>} */ (parsed)
  const issues = []
  if (token_.v !== SHARE_VERSION) issues.push({ path: '/v', message: `share token version ${SHARE_VERSION}` })
  if (typeof token_.s !== 'string') issues.push({ path: '/s', message: 'a share token needs its sequence' })
  if (issues.length) throw new DocumentError(issues)
  const document = fromSequence(token_.s)
  if (token_.t !== undefined) document.title = token_.t
  if (token_.r !== undefined) document.render = token_.r
  if (token_.e !== undefined) document.extensions = token_.e
  const allocator = allocatorFor(document)
  for (const [path, fields] of Array.isArray(token_.l) ? token_.l : []) {
    if (typeof path !== 'string' || !object(fields)) { issues.push({ path: '/l', message: 'a layer is a path and its fields' }); continue }
    const found = findAt(document.root, path)
    if (!found) { issues.push({ path: `/l/${path}`, message: 'no layer at this path' }); continue }
    /** @type {Node} */
    let node = found.node
    if (fields.k === GROUP) {
      const wrapped = /** @type {Node} */ ({ id: allocator.next(), kind: 'group', child: { ...node } })
      if (found.parent === null) document.root = wrapped
      else if (found.key === 'child') /** @type {import('./model.js').Group} */ (/** @type {unknown} */ (found.parent)).child = wrapped
      else /** @type {import('./model.js').OperatorNode} */ (/** @type {unknown} */ (found.parent)).children[found.index] = wrapped
      node = wrapped
    }
    if (fields.n !== undefined) node.name = fields.n
    if (fields.x !== undefined) node.transform = fields.x
    if (fields.e !== undefined) node.extensions = fields.e
  }
  if (issues.length) throw new DocumentError(issues)
  if (Array.isArray(token_.g)) {
    const ids = new Map([...pathOf(document.root)].map(([path, node]) => [path, node.id]))
    document.geometryEdits = token_.g.map(/** @param {any} edit */ edit => ({ ...edit, node: ids.get(edit.node) ?? edit.node, id: edit.id ?? allocator.next() }))
  }
  return assertDocument(document)
}

/** A layer by its share path, with where it sits. A group child answers its group. @param {Node} root @param {string} path
 *  @returns {{ node: Node, parent: import('./model.js').OperatorNode | import('./model.js').Group | null, key: 'children' | 'child' | null, index: number } | null} */
function findAt(root, path) {
  /** @type {Node} */
  let node = root
  /** @type {import('./model.js').OperatorNode | import('./model.js').Group | null} */
  let parent = null
  let key = /** @type {'children' | 'child' | null} */ (null)
  let index = -1
  if (!path) return { node, parent, key, index }
  for (const segment of path.split('.')) {
    parent = node.kind === 'operator' || node.kind === 'group' ? /** @type {any} */ (node) : null
    if (!parent) return null
    if (segment === GROUP) {
      if (parent.kind !== 'group') return null
      node = parent.child
      key = 'child'
      index = 0
    } else {
      const at = Number(segment)
      if (parent.kind !== 'operator' || !Number.isInteger(at) || !parent.children[at]) return null
      node = parent.children[at]
      key = 'children'
      index = at
    }
  }
  return { node, parent, key, index }
}
