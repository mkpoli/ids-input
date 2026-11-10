// @ts-check
// The tokens of the sequence field: a part, an operator or a loose mark, each with the offsets a
// caret and a selection use. The engine reads the same notation, so it reads the tokens too; this
// adds what only the editor draws with, the tint of a part's place in the tree.
import { tokens } from '@han-compose/composer/tokens'

/** @typedef {import('@han-compose/composer/tokens').Token} Token */
export { tokens }

/** A layer takes one pastel hue: its operands and the operator that opens it share it. A plain
 * part takes the hue of the layer it sits in. Light and dark palettes follow the component’s
 * inherited color-scheme.
 * @param {number[]} path @param {boolean} [operator] */
export function tint(path, operator = false) {
  const hue = layerHue(operator || !path.length ? path : path.slice(0, -1))
  return `light-dark(oklch(72% 0.13 ${hue}), oklch(82% 0.11 ${hue}))`
}

/** The hue of the layer an operator opens. Every operand of that operator shares it; a deeper
 * operator shifts within its branch. The root layer keeps the workshop’s base hue.
 * @param {number[]} operatorPath */
function layerHue(operatorPath) {
  return operatorPath.length
    ? [350, 210, 75][operatorPath[0] % 3] + operatorPath.slice(1).reduce((sum, n, i) => sum + (n - .5) * 24 / (i + 1), 0)
    : 305
}

/** The smallest subtree containing a nonempty text range. A range inside an operator's zi.tools
 * modifier names no part: the modifier is text, not a separate part of the tree.
 * @param {Token[]} spans @param {number} start @param {number} end */
export function rangeToken(spans, start, end) {
  if (start === end) return null
  return spans.filter(token => token.start <= start && token.end >= end
    && !(token.noteStart !== undefined && start >= token.noteStart && end <= (token.noteEnd ?? token.noteStart)))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null
}
