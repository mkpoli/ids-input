// A sequence in the page's address, so a link opens it: `#⿰亻哥` (also read: `?ids=⿰亻哥`).
// A share dialog may add the complete document as `?doc=<base64url>`.
import { readShareDocument, shareDocument } from '../../src/document/index.js'

/** The sequence a link carries, or ''. @param {Location | URL} where */
export function sequenceFrom(where) {
  const hash = where.hash.replace(/^#/, '')
  try {
    if (hash) return decodeURIComponent(hash)
  } catch { /* A hash that is not a sequence. */ }
  return new URLSearchParams(where.search).get('ids') ?? ''
}

/** The link to `sequence` on this page, with an optional complete document. @param {string} sequence @param {Location | URL} where @param {import('../../src/document/index.js').Document | null} [document] */
export function linkTo(sequence, where, document = null) {
  const url = new URL(where.href)
  url.searchParams.delete('ids')
  if (document) url.searchParams.set('doc', shareDocument(document))
  else url.searchParams.delete('doc')
  url.hash = sequence ? encodeURIComponent(sequence) : ''
  return url.href
}


/** Whether any layer carries an authored transform. @param {import('../../src/document/index.js').Node} root */
function transformed(root) {
  if (root.transform?.length) return true
  if (root.kind === 'operator') return root.children.some(transformed)
  if (root.kind === 'group') return transformed(root.child)
  return false
}

/** The document to put in the address bar: only when it carries transforms worth preserving.
 *  Structure and sequence already travel in the hash. @param {import('../../src/document/index.js').Document | null} document */
export function addressDocument(document) {
  return document && transformed(document.root) ? document : null
}

/** The document a link carries, or null. @param {Location | URL} where */
export function documentFrom(where) {
  const token = new URLSearchParams(where.search).get('doc')
  if (!token) return null
  try { return readShareDocument(token) } catch { return null }
}
