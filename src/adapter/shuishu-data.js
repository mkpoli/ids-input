// @ts-check
// The Shuishu palette index: the characters and radicals of the proposed block as parts, so they
// can be picked and found by their names, readings and meanings.
import { isShuishu } from '../core/ids.js'
export { isShuishu }

/** A query written as an IDS with one of the operators the data uses. */
const IDS = /^[⿰⿱⿴⿵⿶]/

/**
 * A Shuishu palette part: `shuiName` is the proposed character's name, without the `SHUISHU
 * LOGOGRAM` prefix, `shuiReading` the reading the spreadsheet gives, `shuiMeaning` the dictionaries'
 * meaning, usually one Han character, `shuiGloss` its English gloss and, for the characters
 * `data/shuishu/ids.json` decomposes, `ids` its editorial IDS.
 * @typedef {import('./types.js').PalettePart & { part: string, kind: 'shui', shuiGroup: 'dictionary' | 'logogram' | 'radical', shuiName: string, ids?: string | null }} ShuishuPart
 *
 * @typedef {{ format: number, parts: ShuishuPart[], proposal?: unknown, ids?: { note: string, count: number } }} ShuishuData
 */

/** @param {ShuishuData} doc @returns {ShuishuPart[]} */
export function shuishuTable(doc) {
  if (doc.format !== 1 || !Array.isArray(doc.parts)) throw new Error('Unsupported Shuishu data format')
  return doc.parts
}

/**
 * What a part is called wherever the editor names one. The code point carries 暫定, since the
 * block is a proposal and a bare `U+1B300` would read as an assignment.
 * @param {ShuishuPart} part
 */
export const shuishuLabel = part => [
  `水書 ${part.shuiGroup === 'radical' ? '部件' : '字'}`,
  part.shuiName,
  part.shuiReading,
  part.shuiMeaning && part.shuiGloss ? `${part.shuiMeaning} (${part.shuiGloss})` : part.shuiMeaning ?? part.shuiGloss,
  part.ids,
  `U+${part.part.codePointAt(0)?.toString(16).toUpperCase()}（暫定）`,
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
 * The characters a query names: the Shuishu characters it contains, then the ones whose editorial
 * IDS is the query, then the ones a whole name, reading or meaning equals. A typed character or
 * chart name stands on its own; a reading or a meaning ranks below the vocabulary, since it says
 * little about which character is meant.
 * @param {ShuishuData} doc @param {string} query @param {number} [limit]
 * @returns {{ char: string, label: string, rank?: number }[]}
 */
export function shuishuNames(doc, query, limit = 12) {
  const text = query.trim()
  if (!text) return []
  if (!text.includes(' ')) {
    // A whole description before the characters it is made of: ⿱𛔁𛔀 names the character built
    // that way, not its two parts.
    if (IDS.test(text)) {
      const built = doc.parts.filter(part => part.ids === text)
      if (built.length) return built.slice(0, limit).map(part => ({ char: part.part, label: shuishuLabel(part), rank: 0 }))
    }
    const parts = index(doc)
    const typed = [...text].filter(isShuishu).map(char => parts.get(char)).filter(part => part !== undefined)
    if (typed.length) return typed.slice(0, limit).map(part => ({ char: part.part, label: shuishuLabel(part) }))
    const named = text.toLowerCase()
    const exact = doc.parts.filter(part => part.shuiName.toLowerCase() === named)
    if (exact.length) return exact.slice(0, limit).map(part => ({ char: part.part, label: shuishuLabel(part) }))
  }
  const lowered = text.toLowerCase()
  const hits = []
  for (const part of doc.parts) {
    if (hits.length >= limit) break
    const senses = [part.shuiReading, part.shuiMeaning, part.shuiGloss, part.ids]
      .filter(Boolean).flatMap(value => String(value).split(';')).map(sense => sense.trim().toLowerCase())
    if (senses.includes(lowered)) hits.push({ char: part.part, label: shuishuLabel(part), rank: 5 })
  }
  return hits
}
