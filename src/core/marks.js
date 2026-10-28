// @ts-check
// Loose marks: what may trail a description and annotate the whole of it, as a voicing dot, a tone
// mark or a superscript does. They are Unicode characters, not operators; `data/unicode-properties.json`
// pins the ones that count (combining marks and modifier letters, the accent and tone-letter symbols,
// and superscript or subscript digits). A description is written as its operators and components,
// then the marks in any order: ⿰亻木ˊ, ⿰ㄅㄚˇ, ⿰氵青゛.
import { unicodeProperty } from './unicode.js'

/** A variation selector, as `isSelector` reads it in `ids.js`; kept here so the modules need not cycle. */
const SELECTOR = /^[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]$/u
const isSelector = (/** @type {string | undefined} */ char) => char !== undefined && SELECTOR.test(char)

/**
 * Whether `char` may be a loose mark: a combining mark, a modifier letter, an accent or tone-letter
 * symbol, or a superscript or subscript digit. Other symbols, letters and digits are components, as
 * they were before.
 * @param {string | undefined} char
 */
export const isMark = char => unicodeProperty('marks', char)

/** Whether `text` is one or more loose marks and nothing else. @param {string | null | undefined} text */
export const isMarks = text => {
  const chars = [...(text ?? '')]
  return chars.length > 0 && chars.every(isMark)
}

/**
 * A component or a part split at its first character: the base (with its variation selector) and the
 * loose marks that follow. A part that is itself a mark keeps it as its base, so a lone ˊ put in a
 * draft stays the component it is.
 * @param {import('./ids.js').Part} part
 * @returns {{ base: import('./ids.js').Part, marks: string }}
 */
export function splitMarks(part) {
  if (typeof part !== 'string') {
    if (part === null || part === undefined) return { base: part ?? null, marks: '' }
    return part.marks ? { base: { op: part.op, parts: part.parts }, marks: part.marks } : { base: part, marks: '' }
  }
  const chars = [...part]
  let at = 1
  if (isSelector(chars[at])) at++
  return { base: chars.slice(0, at).join(''), marks: chars.slice(at).join('') }
}

/** The loose marks `part` carries. @param {import('./ids.js').Part} part */
export const marksOf = part => splitMarks(part).marks

/** `part` without its loose marks. @param {import('./ids.js').Part} part */
export const withoutMarks = part => splitMarks(part).base

/** Whether `part` carries any loose mark. @param {import('./ids.js').Part} part */
export const isMarked = part => marksOf(part) !== ''

/**
 * `part` with `marks` trailing it; a component keeps them in its text, a node in `marks`.
 * @param {import('./ids.js').Part} part
 * @param {string} marks
 * @returns {import('./ids.js').Part}
 */
export function withMarks(part, marks) {
  if (!marks) return part
  if (part === null || part === undefined) return part
  if (typeof part === 'string') return part + marks
  return { ...part, marks: (part.marks ?? '') + marks }
}

/**
 * `tree` with every loose mark hoisted to its root, in reading order, and none left inside. The
 * text of a description can only carry marks at its end, so a mark an edit leaves on an inner part
 * belongs to the whole: dropping a marked sequence into a slot annotates the description it joins.
 * @param {import('./ids.js').Part} tree
 * @returns {import('./ids.js').Part}
 */
export function normalizeMarks(tree) {
  /** @type {string[]} */
  const found = []
  /** @param {import('./ids.js').Part} part @returns {import('./ids.js').Part} */
  const strip = part => {
    if (part === null) return null
    if (typeof part === 'string') {
      const { base, marks } = splitMarks(part)
      if (marks) found.push(marks)
      return base
    }
    if (part.marks) found.push(part.marks)
    return { op: part.op, parts: part.parts.map(strip) }
  }
  const base = strip(tree)
  return found.length ? withMarks(base, found.join('')) : tree
}
