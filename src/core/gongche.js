// @ts-check
import { isSequence } from './ids.js'
/** @typedef {import('../adapter/types.js').PalettePart} GongchePart */
/** @param {string} text @param {number[]} strokes @returns {GongchePart[]} */
const notes = (text, strokes) => [...text].map((part, i) => ({ part, strokes: strokes[i], kind: 'c' }))
/** @type {{ key: string, parts: GongchePart[] }[]} */
export const GONGCHE_GROUPS = [
  { key: 'notes', parts: notes('合四一上尺工凡六五乙', [6,5,1,3,4,3,3,4,4,1]) },
  { key: 'regional', parts: notes('士反乂', [3,4,2]) },
  { key: 'modifiers', parts: [
    { part: '亻', strokes: 2, kind: 'c' },
    { part: '彳', strokes: 3, kind: 'c' },
    { part: '⿱𰀪亻', strokes: 4, derived: 1, kind: 'c' },
    { part: '氵', strokes: 3, kind: 'c' },
    { part: '⿰氵氵', strokes: 6, derived: 1, kind: 'c' },
  ] },
]
export const GONGCHE_PARTS = GONGCHE_GROUPS.flatMap(group => group.parts)
/** Filter inside the notation catalogue, preserving group order.
 * @param {string} query */
export function gongcheGroups(query = '') {
  const text = query.trim()
  return GONGCHE_GROUPS.map(group => ({ ...group, parts: group.parts.filter(part => !text ||
    (/^\d+$/.test(text) ? part.strokes === Number(text) : part.part.includes(text) || !isSequence(text) && [...text].includes(part.part))) }))
    .filter(group => group.parts.length)
}
