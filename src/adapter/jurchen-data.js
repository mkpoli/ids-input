// @ts-check
// The Jurchen palette index: Unicode's characters and radicals as parts, findable by Alari's stroke
// codes, the readings of Jin Qizong's dictionary, numeric value and code point.
import { isJurchen } from '../core/ids.js'
export { isJurchen }

/** One typed character or radical, with its variation selector if it has one. */
const TYPED = /[\u{18E00}-\u{19191}\u{191A0}-\u{191D2}][\uFE00-\uFE04]?/gu

/**
 * A Jurchen palette part. `jurRadical` is its radical number, `jurCode` Alari's stroke code,
 * `jurReading` the dictionary's reading as Unicode records it, `jurNumeric` Unicode's numeric value
 * and `jurSource` Unicode's source reference. A variant sequence carries its base character's record
 * and its own code. A radical carries only its number and code, and a host's own part may carry
 * none of them.
 * @typedef {import('./types.js').PalettePart & { part: string, kind: 'jur', jurGroup: 'character' | 'variant' | 'radical', jurRadical?: number, jurCode?: string, jurReading?: string | null, jurNumeric?: number | null, jurSource?: string }} JurchenPart
 *
 * @typedef {{ format: number, parts: JurchenPart[], unicode?: string, sources?: unknown, ids?: { note: string, count: number } }} JurchenData
 */

/** @param {JurchenData} doc @returns {JurchenPart[]} */
export function jurchenTable(doc) {
  if (doc.format !== 1 || !Array.isArray(doc.parts)) throw new Error('Unsupported Jurchen data format')
  return doc.parts
}

/**
 * The editorial decompositions as the descriptions the rest of the editor reads. They carry no
 * source region: no source states one.
 * @param {JurchenData} doc
 */
export function jurchenSequences(doc) {
  return new Map(jurchenTable(doc).flatMap(part => part.ids ? [[part.part, [{ text: part.ids, regions: '' }]]] : []))
}

/** What a part is called wherever the editor names one. @param {JurchenPart} part */
export const jurchenLabel = part => [
  `女真 ${part.jurGroup === 'radical' ? '部首' : part.jurGroup === 'variant' ? '異體' : '字'}`,
  part.jurReading,
  part.jurNumeric,
  part.jurCode,
  part.ids,
  part.jurRadical == null ? null : `部首 ${part.jurRadical}`,
  part.strokes == null ? null : `${part.strokes} 畫`,
  part.jurSource,
  [...part.part].map(char => `U+${char.codePointAt(0)?.toString(16).toUpperCase()}`).join(' '),
].filter(value => value != null).join(' · ')

// The readings are written in IPA-like letters a reader rarely has to hand, so a reading and a query
// are both folded to plain letters: ə is typed e, ʃ s or sh, dʒ j or zh, tʃ c or ch, ŋ ng, ï i, x and
// ç h. The source's j is /j/, kept apart from dʒ as y.
/** @param {string} text */
const common = text => text.toLowerCase().normalize('NFC')
  .replace(/dʒ/g, 'J').replace(/tʃ/g, 'C').replace(/ʃ|ɕ/g, 's').replace(/ʒ|ʑ/g, 'J').replace(/ə|ɛ/g, 'e').replace(/ï/g, 'i')
  .replace(/ŋ/g, 'ng').replace(/[xç]/g, 'h').replace(/[\s.()'’·-]/g, '')
/** @param {string} raw */
const foldReading = raw => common(raw).replace(/j/g, 'y').toLowerCase()
/** @param {string} text */
const foldQuery = text => common(text).replace(/zh/g, 'j').replace(/ch/g, 'c').replace(/sh/g, 's').replace(/x/g, 'h').toLowerCase()

/** The closeness of a reading to a query: 0 whole, 1 its start, 2 within it, -1 none.
 * @param {JurchenPart} part @param {string} query */
function readingTier(part, query) {
  if (!part.jurReading) return -1
  const raw = common(query), folded = foldQuery(query), own = common(part.jurReading), reading = foldReading(part.jurReading)
  if (!folded) return -1
  if (own === raw || reading === folded) return 0
  if (reading.startsWith(folded) || own.startsWith(raw)) return 1
  return reading.includes(folded) || own.includes(raw) ? 2 : -1
}

/**
 * The parts a query names, closest first: the character a description builds, a code point with its variants, or the numeral with that value and the
 * characters of that stroke count, or the characters typed, or a stroke code and a reading at once.
 * @param {JurchenPart[]} parts @param {string} query @returns {JurchenPart[]}
 */
export function jurchenMatches(parts, query) {
  const text = query.trim()
  if (!text) return parts
  const built = parts.filter(part => part.ids === text)
  if (built.length) return built
  const hex = /^(u\+)?([0-9a-f]{4,6})$/i.exec(text)
  if (hex) {
    const point = parseInt(hex[2], 16)
    // Bare hex counts only inside the block, so that 10000 stays a number.
    const inBlock = point <= 0x10ffff && isJurchen(String.fromCodePoint(point))
    if (hex[1] || inBlock) return parts.filter(part => part.part.codePointAt(0) === point)
  }
  if (/^\d+$/.test(text)) {
    const value = Number(text)
    return [...parts.filter(part => part.jurNumeric === value), ...parts.filter(part => part.strokes === value && part.jurNumeric !== value)]
  }
  if (isJurchen(text)) {
    const typed = [...new Set(text.match(TYPED))]
    const named = typed.flatMap(char => parts.filter(part => part.part === char))
    // A typed part also lists the characters written with it.
    return [...named, ...parts.filter(part => part.ids && typed.some(char => part.ids?.includes(char)) && !named.includes(part))]
  }
  const code = text.toLowerCase()
  const tiers = /** @type {JurchenPart[][]} */ ([[], [], [], [], []])
  for (const part of parts) {
    const reading = readingTier(part, text)
    if (part.jurCode === code) tiers[0].push(part)
    else if (reading === 0) tiers[1].push(part)
    else if (part.jurCode?.startsWith(code)) tiers[2].push(part)
    else if (reading === 1) tiers[3].push(part)
    else if (reading === 2) tiers[4].push(part)
  }
  return tiers.flat()
}

/**
 * The characters a search names: a typed character stands on its own; a whole reading, stroke code
 * or numeric value ranks below the vocabulary, since it says little about which character is meant.
 * @param {JurchenData} doc @param {string} query @param {number} [limit]
 * @returns {{ char: string, label: string, rank?: number }[]}
 */
export function jurchenNames(doc, query, limit = 12) {
  const text = query.trim()
  if (!text) return []
  // A whole description before the characters it is made of.
  const built = doc.parts.filter(part => part.ids === text)
  if (built.length) return built.slice(0, limit).map(part => ({ char: part.part, label: jurchenLabel(part), rank: 0 }))
  if (isJurchen(text)) {
    return jurchenMatches(doc.parts, text).slice(0, limit).map(part => ({ char: part.part, label: jurchenLabel(part) }))
  }
  const code = text.toLowerCase()
  const value = /^\d+$/.test(text) ? Number(text) : null
  return doc.parts.filter(part => part.jurCode === code || part.jurNumeric === value && value !== null || readingTier(part, text) === 0).slice(0, limit)
    .map(part => ({ char: part.part, label: jurchenLabel(part), rank: 5 }))
}
