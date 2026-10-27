// @ts-check
// Pinned UCD properties, shared by parsing, search and outline generation.
import data from '../../data/unicode-properties.json' with { type: 'json' }

export const UNICODE_VERSION = data.version
/** @param {'graphic' | 'letters' | 'ideographic'} property @param {string | null | undefined} char */
export function unicodeProperty(property, char) {
  const cp = char?.codePointAt(0)
  if (cp === undefined) return false
  const ranges = data[property]
  let lo = 0, hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [start, end] = ranges[mid]
    if (cp < start) hi = mid - 1
    else if (cp > end) lo = mid + 1
    else return true
  }
  return false
}
