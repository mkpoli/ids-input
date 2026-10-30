// @ts-check
import { isNode, parse, splitDescription, write } from '../core/ids.js'
import { isComponentForm, isGroupedForm } from './component-forms.js'
import { hasPaletteGlyph } from './palette.js'
import { hasBundledGlyph } from './bundled-coverage.js'
import { hasNewKorean } from './new-korean.js'
import { hasUnicodeGlyph } from './unicode.js'

/** Whether every filled leaf has bundled outlines. @param {string} sequence @param {boolean} [separate] @param {boolean} [unicode] @param {string} [fontStyle] */
export function onlyBundled(sequence, separate = false, unicode = false, fontStyle = 'sans') {
  // A loose mark loads from the bundled Unicode outlines; the description before it decides the rest.
  const { base, marks } = splitDescription(sequence)
  if (marks && ![...marks].every(hasUnicodeGlyph)) return false
  const result = parse(base, { open: true })
  if (result.problem || result.tree === null) return false
  let filled = false
  /** @param {import('../core/ids.js').Part} node */
  const local = node => {
    if (node === null) return true
    if ((separate ? isGroupedForm : isComponentForm)(write(node), fontStyle)) { filled = true; return true }
    if (isNode(node)) return node.parts.every(local)
    filled = true
    return (unicode && hasUnicodeGlyph(node)) || hasPaletteGlyph(node) || hasBundledGlyph('tangut', node) || hasBundledGlyph('bopomofo', node) || hasBundledGlyph('small-seal', node) || hasNewKorean(node) || hasBundledGlyph('shuishu', node)
  }
  return local(result.tree) && filled
}
