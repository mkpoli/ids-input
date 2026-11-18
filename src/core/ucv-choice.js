// Persist the spelling of the selected occurrence. Catalogue examples describe hosts
// containing a form, so only explicit whole-character witnesses are indexed as hosts.
import { isNode, parse, sameTree, variantOf, write } from './ids.js'
import { marksOf, withoutMarks, withMarks } from './marks.js'
import { compatibilitySequences } from './compatibility.js'
import registered from '../../data/ucv-spellings.json' with { type: 'json' }
import { glyphReference } from './forms.js'

/** @param {import('./ucv.js').UcvForm} form */
export function formSpelling(form) {
  return form.text ? compatibilitySequences(form.text) : /** @type {Record<string, string>} */ (registered)[form.glyph] ?? glyphReference(form.glyph)
}

/** @typedef {import('./ids.js').Part} Part */
/** @param {Part} pattern @param {Part} part @param {Part[]} operands @returns {boolean} */
function match(pattern, part, operands) {
  if (pattern === null) { operands.push(part); return true }
  if (!isNode(pattern) || !isNode(part)) return sameTree(pattern, part)
  return pattern.op === part.op && pattern.note === part.note && pattern.parts.every((child, i) => match(child, part.parts[i], operands))
}

/** @param {Part} pattern @param {Part[]} operands */
function fill(pattern, operands) {
  if (operands.every(part => part === null)) return pattern
  let i = 0
  /** @param {Part} part @returns {Part} */
  function visit(part) {
    if (part === null) return operands[i++] ?? null
    return isNode(part) ? { ...part, parts: part.parts.map(visit) } : part
  }
  const result = visit(pattern)
  return i === operands.length ? result : undefined
}

/** @param {import('./ucv.js').UcvIndex} index @param {Part | undefined} picked */
export function ucvChoices(index, picked) {
  if (picked == null) return []
  const part = /** @type {Part} */ (withoutMarks(picked))
  const text = write(part)
  const comparable = isNode(part) ? parse(compatibilitySequences(text), { open: true }).tree : part
  const base = typeof part === 'string' ? variantOf(part).base : text
  const entries = new Set(index.formsOf(base))
  const half = /^半[\u{E0100}-\u{E0103}]?$/u.test(base)
  const xiao = /^肖[\u{E0100}-\u{E0103}]?$/u.test(base)
  if (half || xiao) entries.add(index.find(half ? '24' : '28')[0])
  if (isNode(part)) {
    for (const entry of index.templates) entries.add(entry)
    for (const entry of index.formsOf(part.op)) entries.add(entry)
  }
  return [...entries].filter(entry => entry?.kind === 'unifiable').flatMap(entry => {
    /** @type {Part[]} */
    let operands = []
    if (isNode(part)) {
      const matched = [...entry.forms.map(form => form.text), ...index.patterns.get(entry) ?? []].some(text => {
        operands = []
        const pattern = text && parse(compatibilitySequences(text), { open: true }).tree
        return pattern !== undefined && pattern !== '' && comparable !== undefined && match(pattern, comparable, operands)
      })
      if (!matched) return []
    }
    const listed = entry.id === '22' ? [...entry.forms, { glyph: 'u516b', text: '八' }] : entry.forms
    const forms = listed.flatMap(form => {
      // UCV 28 illustrates the upper three strokes. Keep the flesh component in 肖.
      const spelling = xiao && entry.id === '28'
        ? (form.glyph === 'u21b54-03' ? '肖\u{E0101}' : '肖\u{E0100}')
        : formSpelling(form)
      const pattern = parse(spelling, { open: true }).tree
      if (pattern === undefined) return []
      const filled = fill(pattern, operands)
      if (filled == null) return []
      const next = /** @type {Part} */ (withMarks(filled, marksOf(picked)))
      return sameTree(next, picked) ? [] : [{ ...form, write: write(next), tree: next }]
    })
    return forms.length ? [{ id: entry.id, note: entry.note, forms }] : []
  })
}
