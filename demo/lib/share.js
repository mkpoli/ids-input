// A sequence in the page's path, so a link opens it and crawlers can preview it: `/s/⿰亻哥` (also
// read: `#⿰亻哥`, `?ids=⿰亻哥`). A document that carries more than its sequence adds that difference
// as `?doc=<base64url>`.
import { carriedMore, readShareDocument, shareDocument } from '../../src/document/index.js'

/** The sequence a link carries, or ''. @param {Location | URL} where */
export function sequenceFrom(where) {
  const path = /^\/s\/(.+)$/.exec(where.pathname)
  if (path) {
    try { return decodeURIComponent(path[1].replace(/\/$/, '')) } catch { /* A path that is not a sequence. */ }
  }
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
  url.pathname = sequence ? `/s/${encodeURIComponent(sequence)}` : '/'
  url.hash = ''
  return url.href
}

/** Whether any layer carries an authored transform. @param {import('../../src/document/index.js').Node} root */
export function transformed(root) {
  if (root.transform?.length) return true
  if (root.kind === 'operator') return root.children.some(transformed)
  if (root.kind === 'group') return transformed(root.child)
  return false
}

/** The document to put in a link: only when it holds more than the sequence. The path carries the
 *  sequence and the token everything else. @param {import('../../src/document/index.js').Document | null} document */
export function addressDocument(document) {
  return document && carriedMore(document) ? document : null
}

/** Whether two documents share alike, their property order aside. @param {import('../../src/document/index.js').Document | null} [a] @param {import('../../src/document/index.js').Document | null} [b] */
export function sameShare(a, b) {
  return (a ? shareDocument(a) : '') === (b ? shareDocument(b) : '')
}

/** The document a link carries, or null. @param {Location | URL} where */
export function documentFrom(where) {
  const token = new URLSearchParams(where.search).get('doc')
  if (!token) return null
  try { return readShareDocument(token) } catch { return null }
}
