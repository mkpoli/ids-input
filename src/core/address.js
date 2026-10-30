// @ts-check
// Which address paths name a sequence. The app and the worker in front of it read them the same way.

/** The one path segment that names a sequence, or null for another path: a file (`embed.html`,
 *  `robots.txt`), an asset below `assets/`, or the root. A trailing slash is ignored.
 *  @param {string} pathname */
export function sequenceOfPath(pathname) {
  let path = pathname
  try { path = decodeURIComponent(path) } catch { return null }
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (!path.startsWith('/')) return null
  const segment = path.slice(1)
  return segment && !segment.includes('/') && !segment.includes('.') ? segment : null
}
