// @ts-check
import { isSequence } from './ids.js'
/** @typedef {import('../adapter/types.js').PalettePart & { detail: string, example?: string }} GongchePart */
/** @param {string} text @param {number[]} strokes @param {string} detail @returns {GongchePart[]} */
const notes = (text, strokes, detail) => [...text].map((part, i) => ({ part, strokes: strokes[i], kind: 'c', detail }))
/** @type {{ key: string, parts: GongchePart[] }[]} */
export const GONGCHE_GROUPS = [
  { key: 'notes', parts: notes('合四一上尺工凡六五乙', [6,5,1,3,4,3,3,4,4,1], 'note') },
  { key: 'regional', parts: notes('士反乂', [3,4,2], 'regionalNote') },
  { key: 'modifiers', parts: [
    { part: '亻', strokes: 2, kind: 'c', detail: 'person', example: '⿰亻工' },
    { part: '彳', strokes: 3, kind: 'c', detail: 'step', example: '⿰彳工' },
    { part: '⿱𰀪亻', strokes: 4, derived: 1, kind: 'c', detail: 'triple', example: '⿰⿱𰀪亻工' },
    { part: '氵', strokes: 3, kind: 'c', detail: 'water', example: '⿰氵工' },
    { part: '⿰氵氵', strokes: 6, derived: 1, kind: 'c', detail: 'doubleWater', example: '⿰⿰氵氵工' },
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
