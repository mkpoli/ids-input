// @ts-check
/** @param {string} text */
export const isSmallSeal = text => /^[\u{3D000}-\u{3FC3F}]$/u.test(text)
/**
 * @typedef {{ format: number, table: Record<string, string[]>, modern: Record<string, string[]>, parts: import('./types.js').PalettePart[] }} SmallSealData
 */
/** @param {SmallSealData} doc */
export function sealTable(doc) {
  if (doc.format !== 1) throw new Error('Unsupported Small Seal data format')
  return new Map(Object.entries(doc.table).map(([char, texts]) => [char, texts.map(text => ({ text, regions: '' }))]))
}
/** @param {SmallSealData} doc @param {string} query */
export function sealNames(doc, query) {
  const available = new Set([...Object.keys(doc.table), ...doc.parts.map(p => p.part)])
  return Object.entries(doc.modern).filter(([char, names]) => available.has(char) && names.includes(query))
    .map(([char, names]) => ({ char, label: `小篆 · ${names.join(' / ')} · U+${char.codePointAt(0)?.toString(16).toUpperCase()}` }))
}
