// @ts-check
import { rateFormsFor } from '@han-compose/composer/rate-forms'
import { parse, write } from './ids.js'
import { marksOf, withoutMarks, withMarks } from './marks.js'

/** The selected component or subtree, without the marks on that position.
 * @param {import('./ids.js').Part | undefined} part */
export const rateFormText = part => part == null ? '' : write(withoutMarks(part))

/** The four reviewed 率 forms, in row order, for a host or its exact IDS.
 * @param {import('./ids.js').Part | undefined} part */
export const rateFormsOfPart = part => rateFormsFor(rateFormText(part))

/** Read a replacement for this position, carrying its marks onto the new part.
 * @param {import('./ids.js').Part | undefined} part @param {string} text */
export function readRateForm(part, text) {
  if (part == null || rateFormText(part) === text) return null
  const result = parse(text, { open: true })
  return result.problem || result.tree == null ? null : withMarks(result.tree, marksOf(part))
}
