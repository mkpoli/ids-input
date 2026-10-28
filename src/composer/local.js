// @ts-check
import { isNode, parse, write } from '../core/ids.js'
import { isComponentForm, isGroupedForm } from './component-forms.js'
import { hasTangut } from './tangut.js'
import { hasSmallSeal } from './small-seal.js'
import { hasBopomofo } from './bopomofo.js'
import { hasPaletteGlyph } from './palette.js'
import { hasNewKorean } from './new-korean.js'
import { hasUnicodeGlyph } from './unicode.js'

/** Whether every filled leaf has bundled outlines. @param {string} sequence @param {boolean} [separate] @param {boolean} [unicode] @param {string} [fontStyle] */
export function onlyBundled(sequence, separate = false, unicode = false, fontStyle = 'sans') {
  const result = parse(sequence, { open: true })
  if (result.problem || result.tree === null) return false
  let filled = false
  /** @param {import('../core/ids.js').Part} node */
  const local = node => {
    if (node === null) return true
    if (fontStyle !== 'kaisho' && (separate ? isGroupedForm : isComponentForm)(write(node))) { filled = true; return true }
    if (isNode(node)) return node.parts.every(local)
    filled = true
    return (unicode && hasUnicodeGlyph(node)) || hasPaletteGlyph(node) || hasTangut(node) || hasBopomofo(node) || hasSmallSeal(node) || hasNewKorean(node)
  }
  return local(result.tree) && filled
}
