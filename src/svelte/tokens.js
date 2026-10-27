// @ts-check
import { arity, isSelector, parse } from '../core/ids.js'
import { strokeChainLength } from '../core/strokes.js'

/** @typedef {{path: number[], start: number, end: number, tokenEnd: number, text: string}} Token */
/** UTF-16 offsets match the native input, including supplementary characters and selectors.
 * Invalid drafts have no structural mapping. Missing slots occupy zero width.
 * @param {string} text @returns {Token[]} */
export function tokens(text) {
  if (!text || parse(text, { open: true }).problem) return []
  /** @type {Token[]} */ const out = []
  let at = 0
  /** @param {number[]} path */
  function read(path) {
    const start = at
    const char = String.fromCodePoint(text.codePointAt(at) ?? 0)
    if (at < text.length) at += char.length
    // A stroke chain that names a character is one component, its text the chain as written.
    const chain = char === '#' ? strokeChainLength(text, start) : 0
    if (chain) {
      at = start + chain
      if (isSelector([...text.slice(at)][0])) at += [...text.slice(at)][0].length
      out.push({ path, start, tokenEnd: at, end: at, text: text.slice(start, at) })
      return
    }
    const n = arity(char)
    if (!n && isSelector([...text.slice(at)][0])) at += [...text.slice(at)][0].length
    const token = { path, start, tokenEnd: at, end: at, text: text.slice(start, at) }
    out.push(token)
    for (let i = 0; i < n; i++) read([...path, i])
    token.end = at
  }
  read([])
  return out
}

/** Related branches share a pastel hue; nested siblings shift gently within it.
 * Light and dark palettes follow the component’s inherited color-scheme.
 * @param {number[]} path */
export function tint(path) {
  const hue = path.length ? [350, 210, 75][path[0] % 3] + path.slice(1).reduce((sum, n, i) => sum + (n - .5) * 24 / (i + 1), 0) : 305
  return `light-dark(oklch(72% 0.13 ${hue}), oklch(82% 0.11 ${hue}))`
}

/** The smallest subtree containing a nonempty text range. @param {Token[]} spans @param {number} start @param {number} end */
export function rangeToken(spans, start, end) {
  if (start === end) return null
  return spans.filter(token => token.start <= start && token.end >= end)
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null
}
