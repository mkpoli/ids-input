// A component spelled in full where characters write a positional form of it (竹 on top, written
// 𥫗): the description respelled with the form, offered beside what was typed and never in its
// place. The pairs come from `data/positional-forms.tsv`.
import { isNode, replaceAt } from './ids.js'

/**
 * @typedef {import('./ids.js').Part} Part
 * @typedef {import('./ids.js').Path} Path
 * @typedef {'left' | 'right' | 'top' | 'bottom'} Place
 * @typedef {Object} PositionalForm
 * @property {string} form The form characters write in the place.
 * @property {number} written How many characters are described with the component itself there.
 * @property {number} formed How many are described with the form there.
 * @typedef {Object} Respelling
 * @property {Path} at Where the component stands in the tree.
 * @property {Place} place
 * @property {string} from The component as written.
 * @property {string} to The form offered for it.
 * @property {number} written
 * @property {number} formed
 */

/** The operators whose first and last operands stand at a named place. */
const PLACES = /** @type {Record<string, [Place, Place]>} */ ({ '⿰': ['left', 'right'], '⿲': ['left', 'right'], '⿱': ['top', 'bottom'], '⿳': ['top', 'bottom'] })

/** The table's rows by place and component. @param {string} text @returns {Map<string, PositionalForm>} */
export function readPositionalForms(text) {
  const out = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [place, char, form, written, formed] = line.split('\t')
    if (form) out.set(`${place}\t${char}`, { form, written: Number(written), formed: Number(formed) })
  }
  return out
}

/**
 * The components of `tree` the table would spell otherwise, in reading order.
 * @param {Part} tree @param {Map<string, PositionalForm>} forms @param {Path} [path] @returns {Respelling[]}
 */
export function positionalRespellings(tree, forms, path = []) {
  if (!isNode(tree)) return []
  const places = PLACES[tree.op]
  return tree.parts.flatMap((part, index) => {
    const at = [...path, index]
    if (isNode(part)) return positionalRespellings(part, forms, at)
    const place = places && (index === 0 ? places[0] : index === tree.parts.length - 1 ? places[1] : null)
    const found = place && typeof part === 'string' ? forms.get(`${place}\t${part}`) : undefined
    return found && place ? [{ at, place, from: /** @type {string} */ (part), to: found.form, written: found.written, formed: found.formed }] : []
  })
}

/**
 * `tree` with every such component respelled, and what changed; null when nothing would.
 * @param {Part} tree @param {Map<string, PositionalForm>} forms @returns {{ tree: Part, changes: Respelling[] } | null}
 */
export function positionalSuggestion(tree, forms) {
  const changes = positionalRespellings(tree, forms)
  if (!changes.length) return null
  return { tree: changes.reduce((next, change) => replaceAt(next, change.at, change.to), tree), changes }
}
