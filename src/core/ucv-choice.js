// Persist the spelling of the selected occurrence. Catalogue examples describe hosts
// containing a form, so only explicit whole-character witnesses are indexed as hosts.
import { isNode, parse, partAt, paths, replaceAt, sameTree, variantOf, write } from './ids.js'
import { marksOf, withoutMarks, withMarks } from './marks.js'
import { variationBase, variationOf } from './variation.js'
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

// In these IWDS entries the component column identifies the complete shape of
// each drawing including its open slot(s), in the same order as the glyphs.
const parallelTemplates = new Set(['188b', '307e', '307f', '312d', '352c', '435'])

/** @param {import('./ucv.js').UcvEntry} entry @param {import('./ucv.js').UcvForm} form
 * @param {number} i @param {string[]} patterns */
function contextualSpelling(entry, form, i, patterns) {
  if (entry.id === '47') return '⿰' + formSpelling(form) + '⬚'
  if (parallelTemplates.has(entry.id)) return patterns[i]
  if (entry.id === '82a' && !form.text) return '⿱⬚&CDP-8DC1;'
  if (entry.id === '230b') return '⿳' + (i === 0 ? '𠂊' : '𠂉') + '&CDP-885E;⬚'
  // Both extended frames put 止 across the horizontal of a right-hand hook.
  // Only the last reference has the dot of 弋 above that horizontal.
  if (entry.id === '444' && !form.text) return i === 1 ? '⿹⿻止⿻一㇂⬚' : '⿹⿻止弋⬚'
  // The middle reference draws its right-hand glyph with u5192-j.
  if (entry.id === '382' && !form.text) return '⿰⬚冒\u{E0100}'
  return null
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
      const patterns = index.patterns.get(entry) ?? []
      const contextual = entry.forms.map((form, i) => contextualSpelling(entry, form, i, patterns))
      const matched = [...entry.forms.map(form => form.text), ...patterns, ...contextual].some(text => {
        if (!text) return false
        operands = []
        const pattern = parse(compatibilitySequences(text), { open: true }).tree
        return pattern !== undefined && comparable !== undefined && match(pattern, comparable, operands)
      })
      if (!matched) return []
    }
    const listed = entry.id === '22' ? [...entry.forms, { glyph: 'u516b', text: '八' }] : entry.forms
    const forms = listed.flatMap((form, i) => {
      // UCV 28 illustrates the upper three strokes. Keep the flesh component in 肖.
      const spelling = xiao && entry.id === '28'
        ? (form.glyph === 'u21b54-03' ? '肖\u{E0101}' : '肖\u{E0100}')
        : (isNode(part) && operands.length ? contextualSpelling(entry, form, i, index.patterns.get(entry) ?? []) : null) ?? formSpelling(form)
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

/** All selectable occurrences inside a complete decomposition of the chosen character.
 * The adapter looks up a plain character, so never use that lookup to open a specific IVS.
 * @param {import('./ucv.js').UcvIndex} index @param {Part | undefined} picked @param {string[]} splits */
export function occurrenceChoices(index, picked, splits) {
  const groups = ucvChoices(index, picked).map(entry => ({ ...entry, context: '' }))
  if (typeof picked !== 'string' || variationBase(picked) !== variationOf(picked)) return groups
  const marks = marksOf(picked)
  const seen = new Set(groups.flatMap(group => group.forms.map(form => form.write)))
  /** @type {Map<string, ReturnType<typeof ucvChoices>>} */
  const matches = new Map()
  const sites = new Set()
  for (const text of new Set(splits)) {
    const source = parse(text).tree
    if (!isNode(source)) continue
    for (const path of paths(source)) {
      const part = partAt(source, path)
      if (part == null) continue
      const token = write(part)
      const site = JSON.stringify([path, token])
      // The expanding lookup visits shorter descriptions first. Opening an
      // unrelated sibling again would repeat the same choice at this site.
      if (sites.has(site)) continue
      sites.add(site)
      let entries = matches.get(token)
      if (!entries) { entries = ucvChoices(index, part); matches.set(token, entries) }
      if (!entries.length) continue
      const context = write(replaceAt(source, path, '〔' + token + '〕'))
      // An entry that unifies two bare operators (⿱ and ⿸) applies where the operands are
      // components. Deeper in an expansion that operator only joins the strokes of a component.
      const nested = isNode(part) && part.parts.some(isNode)
      for (const entry of entries) {
        if (nested && entry.forms.every(form => /^[\u2FF0-\u2FFF\u31EF]$/u.test(form.text ?? ''))) continue
        const forms = entry.forms.flatMap(form => {
          const tree = /** @type {Part} */ (withMarks(replaceAt(source, path, form.tree), marks))
          const written = write(tree)
          if (seen.has(written) || !sameTree(parse(written, { open: true }).tree ?? null, tree)) return []
          seen.add(written)
          return [{ ...form, tree, write: written }]
        })
        if (forms.length) groups.push({ ...entry, forms, context })
      }
    }
  }
  return groups
}
