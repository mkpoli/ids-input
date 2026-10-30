// A sequence in the page's own path, so a link opens it: `/⿰亻哥`. A sequence holding `.` or `/`
// stays in `?ids=`, which the path parser would eat; the fragment `#⿰亻哥` says it too. All are
// read. A document that carries more than its sequence rides in `?doc=<base64url>`.
import { carriedMore, readShareDocument, shareDocument } from '../../src/document/index.js'

/** The one path segment that names a sequence, or null for another path: a file (`embed.html`,
 *  `robots.txt`), an asset below `assets/`, or the root. @param {Location | URL} where */
function pathSequence(where) {
  let path
  try { path = decodeURIComponent(where.pathname) } catch { return null }
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (!path.startsWith('/')) return null
  const segment = path.slice(1)
  // One segment, and no dot: `embed.html` and `robots.txt` are files, not sequences.
  return segment && !segment.includes('/') && !segment.includes('.') ? segment : null
}

/** The sequence a link carries, or ''. @param {Location | URL} where */
export function sequenceFrom(where) {
  const path = pathSequence(where)
  if (path !== null) return path
  const hash = where.hash.replace(/^#/, '')
  try {
    if (hash) return decodeURIComponent(hash)
  } catch { /* A hash that is not a sequence. */ }
  return new URLSearchParams(where.search).get('ids') ?? ''
}

/** The link to `sequence` on this page, with an optional document. @param {string} sequence @param {Location | URL} where @param {import('../../src/document/index.js').Document | null} [document] */
export function linkTo(sequence, where, document = null) {
  const url = new URL(where.href)
  // A `.` or a `/` in the text is not a path segment as it stands: the parser drops the former as a
  // dot segment and reads the latter back as a separator.
  const inPath = Boolean(sequence) && !/[./]/.test(sequence)
  if (inPath) url.searchParams.delete('ids')
  else if (sequence) url.searchParams.set('ids', sequence)
  else url.searchParams.delete('ids')
  const token = document ? shareDocument(document) : ''
  if (token) url.searchParams.set('doc', token)
  else url.searchParams.delete('doc')
  url.pathname = inPath ? `/${encodeURIComponent(sequence)}` : '/'
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

/** The document to put in a link: only when it holds more than the sequence. The path carries
 *  the structure and the characters. @param {import('../../src/document/index.js').Document | null} document */
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
