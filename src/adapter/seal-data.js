// @ts-check
import { readForms } from '../core/search.js'
/** @param {string} text */
export const isSmallSeal = text => /^[\u{3D000}-\u{3FC3F}]$/u.test(text)
/**
 * @typedef {{ format: number, table: Record<string, string[]>, modern: Record<string, string[]>, parts: import('./types.js').PalettePart[], records?: {char: string | null, [key: string]: unknown}[], sources?: unknown[], paletteSources?: unknown[] }} SmallSealData
 */
/** @param {SmallSealData} doc @returns {Map<string, import('../core/decompose.js').Sequence[]>} */
export function sealTable(doc) {
  if (doc.format !== 1) throw new Error('Unsupported Small Seal data format')
  return new Map(Object.entries(doc.table).map(([char, texts]) => [char, texts.map(text => ({ text, regions: '' }))]))
}
/** @param {SmallSealData} doc @param {string} query */
export function sealNames(doc, query) {
  if (isSmallSeal(query)) return (doc.modern[query] ?? []).map(char => ({ char, label: `CJK · U+${char.codePointAt(0)?.toString(16).toUpperCase()}` }))
  return Object.entries(doc.modern).filter(([char, names]) => names.includes(query))
    .map(([char, names]) => ({ char, label: `小篆 · ${names.join(' / ')} · U+${char.codePointAt(0)?.toString(16).toUpperCase()}` }))
}

/**
 * Join seal correspondences to radical-form classes for search only. A historical
 * form can cover several modern spellings; the whole connected group matches.
 * @param {string} text
 * @param {SmallSealData | null | undefined} doc
 * @returns {Map<string, string>}
 */
export function sealForms(text, doc) {
  const rows = Object.entries(doc?.modern ?? {}).flatMap(([seal, names]) => names.map(char => `${char}\t${seal}`))
  return readForms([text, ...rows].join('\n'))
}
