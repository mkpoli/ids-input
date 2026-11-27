// @ts-check
import { yaoOccurrences, selectYao } from '@han-compose/composer/yao-occurrences'
import { yaoFamily } from '@han-compose/composer/yao-catalogue'
import { rateFormsFor } from '@han-compose/composer/rate-forms'
import { parse, write } from './ids.js'
import { marksOf, withoutMarks, withMarks } from './marks.js'

/** The selected component or subtree, without the marks on that position.
 * @param {import('./ids.js').Part | undefined} part */
export const formSpelling = part => part == null ? '' : write(withoutMarks(part))

/** The four reviewed 率 forms, in row order, for a host or its exact IDS.
 * @param {import('./ids.js').Part | undefined} part */
export const rateFormsOfPart = part => rateFormsFor(formSpelling(part))

/** Selectable catalogue families for a position. A caller's equivalent catalogue group takes
 * the place of the bundled four choices, so they appear once when the full registry is supplied.
 * @param {import('./ids.js').Part | undefined} part
 * @param {import('../adapter/types.js').IdsAdapter['variationFamilies']} [lookup]
 * @returns {readonly import('../adapter/types.js').VariationFamily[]} */
export function variationFamiliesOfPart(part, lookup) {
  const text = formSpelling(part)
  if (!text) return []
  const groups = lookup?.(text).filter(family => !family.evidenceOnly && family.forms.length) ?? []
  const forms = rateFormsFor(text)
  const available = [...groups]
  if (forms.length) {
    const host = forms[0].host, id = 'rate/' + host
    const supplied = groups.some(group => group.id === id || (group.forms.length === forms.length &&
      forms.every(form => group.forms.some(option => option.text === form.text))))
    if (!supplied) available.unshift({ id, subjects: [host], forms })
  }
  const occurrences = yaoOccurrences(text)
  for (const [index, site] of occurrences.entries()) {
    if (!site.path.length && groups.some(group => group.id === yaoFamily.id)) {
      available.splice(available.findIndex(group => group.id === yaoFamily.id), 1)
    }
    available.push({
      id: yaoFamily.id + '@' + site.path.join('.'), subjects: yaoFamily.subjects, forms: yaoFamily.forms,
      occurrence: { path: site.path, form: site.form, index, count: occurrences.length },
    })
  }
  return available
}

/** Read a replacement for this position, carrying its marks onto the new part.
 * @param {import('./ids.js').Part | undefined} part @param {string} text */
export function readFormSpelling(part, text) {
  if (part == null || formSpelling(part) === text) return null
  const result = parse(text, { open: true })
  return result.problem || result.tree == null ? null : withMarks(result.tree, marksOf(part))
}

/** Apply a family choice at its addressed occurrence, retaining the marks on the surrounding part.
 * @param {import('./ids.js').Part | undefined} part
 * @param {import('../adapter/types.js').VariationFamily} family @param {string | null} form */
export function chooseVariation(part, family, form) {
  if (family.occurrence) {
    if (form === family.occurrence.form) return null
    return readFormSpelling(part, selectYao(formSpelling(part), [...family.occurrence.path], form))
  }
  const text = family.forms.find(choice => choice.id === form)?.text ?? (form == null ? family.subjects[0] : null)
  return text ? readFormSpelling(part, text) : null
}
