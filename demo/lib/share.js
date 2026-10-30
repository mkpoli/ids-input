// A sequence in the page's address, so a link opens it: `#⿰亻哥` (also read: `?ids=⿰亻哥`).
// A document that carries more than its sequence adds that difference as `?doc=<base64url>`.
import { carriedMore, readShareDocument, shareDocument } from '../../src/document/index.js'

/** The sequence a link carries, or ''. @param {Location | URL} where */
export function sequenceFrom(where) {
  const hash = where.hash.replace(/^#/, '')
  try {
    if (hash) return decodeURIComponent(hash)
  } catch { /* A hash that is not a sequence. */ }
  return new URLSearchParams(where.search).get('ids') ?? ''
}

/** The link to `sequence` on this page, with an optional document. @param {string} sequence @param {Location | URL} where @param {import('../../src/document/index.js').Document | null} [document] */
export function linkTo(sequence, where, document = null) {
  const url = new URL(where.href)
  url.searchParams.delete('ids')
  const token = document ? shareDocument(document) : ''
  if (token) url.searchParams.set('doc', token)
  else url.searchParams.delete('doc')
  url.hash = sequence ? encodeURIComponent(sequence) : ''
  return url.href
}

/** Whether any layer carries an authored transform. @param {import('../../src/document/index.js').Node} root */
export function transformed(root) {
  if (root.transform?.length) return true
  if (root.kind === 'operator') return root.children.some(transformed)
  if (root.kind === 'group') return transformed(root.child)
  return false
}

/** The document to put in a link: only when it holds more than the sequence. The fragment carries
 *  the structure and the characters. @param {import('../../src/document/index.js').Document | null} document */
export function addressDocument(document) {
  return document && carriedMore(document) ? document : null
}

/** The document a link carries, or null. @param {Location | URL} where */
export function documentFrom(where) {
  const token = new URLSearchParams(where.search).get('doc')
  if (!token) return null
  try { return readShareDocument(token) } catch { return null }
}
