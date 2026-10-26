// @ts-check
import { isNode, parse, write } from '../core/ids.js'
import { isComponentForm, isGroupedForm } from './component-forms.js'
import { hasTangut } from './tangut.js'
import { hasBopomofo } from './bopomofo.js'

/** Whether every filled leaf has bundled outlines. @param {string} sequence @param {boolean} [separate] */
export function onlyBundled(sequence, separate = false) {
  const result = parse(sequence, { open: true })
  if (result.problem || result.tree === null) return false
  let filled = false
  /** @param {import('../core/ids.js').Part} node */
  const local = node => {
    if (node === null) return true
    if ((separate ? isGroupedForm : isComponentForm)(write(node))) { filled = true; return true }
    if (isNode(node)) return node.parts.every(local)
    filled = true
    return hasTangut(node) || hasBopomofo(node)
  }
  return local(result.tree) && filled
}
