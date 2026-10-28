// @ts-check
import { isSequence } from './ids.js'
/** @typedef {import('../adapter/types.js').PalettePart} GongchePart */
/** The catalogue is also read by font builders and coverage audits. */
import catalogue from '../../data/gongche-parts.json' with { type: 'json' }
/** @type {{ key: string, parts: GongchePart[], sources: string[] }[]} */
export const GONGCHE_GROUPS = /** @type {{ key: string, parts: GongchePart[], sources: string[] }[]} */ (catalogue.groups)
export const GONGCHE_PARTS = GONGCHE_GROUPS.flatMap(group => group.parts)
/** Filter inside the notation catalogue, preserving group order.
 * @param {string} query */
export function gongcheGroups(query = '') {
  const text = query.trim()
  return GONGCHE_GROUPS.map(group => ({ ...group, parts: group.parts.filter(part => !text ||
    (/^\d+$/.test(text) ? part.strokes === Number(text) : part.part.includes(text) || isSequence(text) && part.aliases?.some(alias => alias.includes(text)) || !isSequence(text) && [...text].includes(part.part))) }))
    .filter(group => group.parts.length)
}
