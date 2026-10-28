// Draw a missing character from the local Unicode outline shards, independently of preview jobs.
import { unicodeSource, hasUnicodeGlyph, compose } from '../../src/composer/index.js'
const source = unicodeSource()
/** @type {Map<string, Promise<import('../../src/adapter/types.js').Drawing | null>>} */
const drawings = new Map()
/** @param {string} part */
export function treeGlyph(part) {
  if (!hasUnicodeGlyph(part)) return Promise.resolve(null)
  if (!drawings.has(part)) {
    const result = compose(source, part).catch(() => { drawings.delete(part); return null })
    drawings.set(part, result)
  }
  return /** @type {Promise<import('../../src/adapter/types.js').Drawing | null>} */ (drawings.get(part))
}
