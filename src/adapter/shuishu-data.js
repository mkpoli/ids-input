// @ts-check
// The Shuishu palette index: the characters and radicals of the proposed block as parts, so they
// can be picked and found by their names, readings and meanings.
import { isShuishu } from '../core/ids.js'
export { isShuishu }

/**
 * A Shuishu palette part: `name` is the proposed character's name, without the `SHUISHU LOGOGRAM`
 * prefix, `reading` its N4758 reading, `meaning` the dictionaries' meaning, usually one Han
 * character, and `meaningEn` the English gloss.
 * @typedef {import('./types.js').PalettePart & { part: string, kind: 'shui', shuiGroup: 'common' | 'logogram' | 'radical', name: string }} ShuishuPart
 *
 * @typedef {{ format: number, parts: ShuishuPart[], proposal?: unknown }} ShuishuData
 */

/** @param {ShuishuData} doc @returns {ShuishuPart[]} */
export function shuishuTable(doc) {
  if (doc.format !== 1) throw new Error('Unsupported Shuishu data format')
  return doc.parts
}

/** What a part is called wherever the editor names one. @param {ShuishuPart} part */
export const shuishuLabel = part => [
  `水書 ${part.shuiGroup === 'radical' ? '部件' : '字'}`,
  part.name,
  part.reading,
  part.meaning && part.meaningEn ? `${part.meaning} (${part.meaningEn})` : part.meaning ?? part.meaningEn,
  `U+${part.part.codePointAt(0)?.toString(16).toUpperCase()}`,
].filter(Boolean).join(' · ')

/** The parts by character, built once per document. @type {WeakMap<ShuishuData, Map<string, ShuishuPart>>} */
const indexes = new WeakMap()
/** @param {ShuishuData} doc */
function index(doc) {
  let map = indexes.get(doc)
  if (!map) indexes.set(doc, map = new Map(doc.parts.map(part => [part.part, part])))
  return map
}

/**
 * The characters a query names: the Shuishu characters it contains, then the ones whose name,
 * reading or meaning contains it (a single character ends the search there).
 * @param {ShuishuData} doc @param {string} query @param {number} [limit]
 * @returns {{ char: string, label: string }[]}
 */
export function shuishuNames(doc, query, limit = 12) {
  const text = query.trim()
  if (!text) return []
  const parts = index(doc)
  const typedChars = [...text].filter(isShuishu)
  const typed = typedChars.map(char => parts.get(char)).filter(part => part !== undefined)
  const hits = typed.map(part => ({ char: part.part, label: shuishuLabel(part) }))
  if (typedChars.length === [...text].length && typedChars.length) return hits
  const seen = new Set(typedChars)
  const lowered = text.toLowerCase()
  for (const part of doc.parts) {
    if (hits.length >= limit) break
    if (seen.has(part.part)) continue
    const names = [part.name, part.meaning, part.meaningEn, part.reading].filter(Boolean)
    if (names.some(name => /** @type {string} */ (name).toLowerCase().includes(lowered))) hits.push({ char: part.part, label: shuishuLabel(part) })
  }
  return hits
}
