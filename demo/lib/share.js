// A sequence in the page's address, so a link opens it: `#⿰亻哥` (also read: `?ids=⿰亻哥`).

/** The sequence a link carries, or ''. @param {Location | URL} where */
export function sequenceFrom(where) {
  const hash = where.hash.replace(/^#/, '')
  try {
    if (hash) return decodeURIComponent(hash)
  } catch { /* A hash that is not a sequence. */ }
  return new URLSearchParams(where.search).get('ids') ?? ''
}

/** The link to `sequence` on this page. @param {string} sequence @param {Location | URL} where */
export function linkTo(sequence, where) {
  const url = new URL(where.href)
  url.searchParams.delete('ids')
  url.hash = sequence ? encodeURIComponent(sequence) : ''
  return url.href
}
