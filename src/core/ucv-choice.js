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

const isOperator = (/** @type {string | undefined} */ text) => /^[\u2FF0-\u2FFF\u31EF]$/u.test(text ?? '')

/** @param {number[]} outer @param {number[]} inner */
const within = (outer, inner) => outer.length <= inner.length && outer.every((step, i) => step === inner[i])

/** All selectable occurrences inside a complete decomposition of the chosen character.
 * Each entry is offered once, at the least expanded place it reaches: a component that has
 * entries of its own is not opened further, and an entry found at a place or around it is not
 * repeated inside. An entry that only swaps an operator applies to the characters it lists, and
 * an entry written in a structure is found where that structure is, never at a bare component.
 * The adapter looks up a plain character, so never use that lookup to open a specific IVS.
 * @param {import('./ucv.js').UcvIndex} index @param {Part | undefined} picked @param {string[]} splits */
export function occurrenceChoices(index, picked, splits) {
  const groups = ucvChoices(index, picked).map(entry => ({ ...entry, context: '' }))
  if (typeof picked !== 'string' || variationBase(picked) !== variationOf(picked)) return groups
  const host = variationBase(/** @type {string} */ (withoutMarks(picked)))
  const marks = marksOf(picked)
  const seen = new Set(groups.flatMap(group => group.forms.map(form => form.write)))
  /** Where each entry is offered, and for a component, its group and what surrounds it.
   * @type {Map<string, { path: number[], around?: string, group?: (typeof groups)[number] }[]>} */
  const offered = new Map(groups.map(group => [group.id, [{ path: [] }]]))
  /** @type {number[][]} */
  const opened = []
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
      // Another spelling of a component in the same place is read; its expansion is not.
      if (opened.some(at => within(at, path) && (at.length < path.length || isNode(part)))) continue
      let found = matches.get(token)
      if (!found) { found = ucvChoices(index, part); matches.set(token, found) }
      const entries = found.filter(entry => {
        const catalogued = index.entries.find(one => one.id === entry.id)
        if (!catalogued) return true
        if (catalogued.forms.every(form => isOperator(form.text))) return !path.length && Boolean(host && catalogued.unified?.includes(host))
        return typeof part !== 'string' || !(index.patterns.get(catalogued) ?? []).every(pattern => isNode(parse(pattern, { open: true }).tree ?? null))
      })
      if (!entries.length) continue
      if (typeof part === 'string') opened.push(path)
      const context = write(replaceAt(source, path, '〔' + token + '〕'))
      const around = typeof part === 'string' ? write(replaceAt(source, path, '〔〕')) : undefined
      for (const entry of entries) {
        const earlier = offered.get(entry.id) ?? []
        const same = around && earlier.find(at => at.around === around)
        if (!same && earlier.some(at => within(at.path, path))) continue
        const forms = entry.forms.flatMap(form => {
          const tree = /** @type {Part} */ (withMarks(replaceAt(source, path, form.tree), marks))
          const written = write(tree)
          if (seen.has(written) || !sameTree(parse(written, { open: true }).tree ?? null, tree)) return []
          seen.add(written)
          return [{ ...form, tree, write: written }]
        })
        if (!forms.length) continue
        if (same && same.group) { same.group.forms.push(...forms); continue }
        const group = { ...entry, forms, context }
        offered.set(entry.id, [...earlier, { path, around, group }])
        groups.push(group)
      }
    }
  }
  return groups
}
