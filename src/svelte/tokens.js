// @ts-check
import { hangulClusterAt } from '../core/hangul.js'
import { arity, isMark, isSelector, modifierLength, parse, takesModifier } from '../core/ids.js'
import { emojiPrefix } from '../core/emoji.js'

/** @typedef {{path: number[], start: number, end: number, tokenEnd: number, text: string, noteStart?: number, noteEnd?: number}} Token */
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
    const char = emojiPrefix(text.slice(at)) || String.fromCodePoint(text.codePointAt(at) ?? 0)
    const n = arity(char)
    const cluster = hangulClusterAt([...text.slice(at)], 0)
    let noteStart = 0, noteEnd = 0
    if (cluster) at += cluster.text.length
    else {
      if (at < text.length) at += char.length
      if (n) {
        const note = takesModifier(char) ? modifierLength(text, at) : 0
        if (note) { noteStart = at; at += note; noteEnd = at }
      } else if (isSelector([...text.slice(at)][0])) at += [...text.slice(at)][0].length
    }
    const token = { path, start, tokenEnd: at, end: at, text: text.slice(start, at), ...(noteStart ? { noteStart, noteEnd } : {}) }
    out.push(token)
    for (let i = 0; i < n; i++) read([...path, i])
    token.end = at
  }
  read([])
  // Loose marks trail the whole description: they get a token of their own at the end, belonging to
  // the root, while the root's span reaches over them so a selection of the whole still finds it.
  if (out.length && at < text.length && isMark([...text.slice(at)][0])) {
    out[0].end = text.length
    out.push({ path: [], start: at, tokenEnd: text.length, end: text.length, text: text.slice(at) })
  }
  return out
}

/** Related branches share a pastel hue; nested siblings shift gently within it.
 * Light and dark palettes follow the component’s inherited color-scheme.
 * @param {number[]} path */
export function tint(path) {
  const hue = path.length ? [350, 210, 75][path[0] % 3] + path.slice(1).reduce((sum, n, i) => sum + (n - .5) * 24 / (i + 1), 0) : 305
  return `light-dark(oklch(72% 0.13 ${hue}), oklch(82% 0.11 ${hue}))`
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
