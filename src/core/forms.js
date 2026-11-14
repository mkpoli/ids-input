// @ts-check
// The forms a component may be written as: its character, the variation sequences a face draws of
// it, and the forms of the IRG's component variation entries (UCV, NUCV) it belongs to. A form of an
// entry that is another character or a description is a sibling encoding; one no code point names
// is written with zi.tools' variant identifier after the component (壬q0012, form 2 of UCV #1).
import { isNode, parse, variantIdentifier, variantOf, write } from './ids.js'
import { variationBase, variationOf } from './variation.js'

/**
 * @typedef {object} ComponentForm
 * @property {string} write What the component is written as when this form is chosen.
 * @property {'plain' | 'sequence' | 'sibling' | 'variant'} kind `plain` its character, `sequence`
 *   a variation sequence, `sibling` another character or a description, `variant` the character
 *   with a variant identifier.
 * @property {string} [entry] The UCV or NUCV entry the form is listed in.
 * @property {boolean} [unifiable] Whether that entry is of the unifiable list.
 * @property {number} [form] The form's place in the entry, from 1.
 * @property {string} [glyph] The GlyphWiki glyph the entry names for the form.
 */

/**
 * The reference a description names a GlyphWiki glyph by, where a composer is to draw that glyph:
 * `&GW-u58ec-t;`, an entity as CHISE writes one, read as one component.
 * @param {string} glyph
 */
export const glyphReference = glyph => `&GW-${glyph};`

/**
 * The variant identifier of form `form` (from 1) of UCV entry `entry`, as zi.tools writes it: `q`,
 * the entry number in three digits with its letter, then the form's place, in two digits where
 * the entry has ten forms or more. Null for an entry the notation cannot name (two letters).
 * @param {string} entry @param {number} form @param {number} forms How many forms the entry has.
 * @returns {string | null}
 */
export function ucvIdentifier(entry, form, forms) {
  const read = /^(\d{1,3})([a-z]?)$/.exec(entry)
  if (!read || form < 1 || form > 99) return null
  return `q${read[1].padStart(3, '0')}${read[2]}${forms >= 10 ? String(form).padStart(2, '0') : form}`
}

/**
 * The entry form a component's variant identifier names, where it names one of an entry the
 * component is a form of: 壬q0012 is form 2 of UCV #1. Null for any other identifier.
 * @param {import('./ucv.js').UcvIndex} ucv @param {string} part
 * @returns {{ entry: import('./ucv.js').UcvEntry, form: import('./ucv.js').UcvForm, place: number } | null}
 */
export function ucvFormOf(ucv, part) {
  const { base, variant } = variantOf(part)
  const read = variant ? variantIdentifier(variant) : null
  if (!read || read.kind !== 'ucv' || read.sign !== 'q' || read.other) return null
  const char = variationBase(base)
  // The identifier names forms of the unifiable list only.
  const entry = char === null ? undefined : ucv.formsOf(char).find(found => found.id === read.entry && found.kind === 'unifiable')
  const form = entry?.forms[read.form - 1]
  return entry && form ? { entry, form, place: read.form } : null
}

/**
 * What a component may be written as, its character first; empty where it has no other form.
 * `sequences` gives the variation sequences a face draws, by character; `ucv` the component
 * variation lists. A form listed twice is given once, where it is first met.
 * @param {import('./ids.js').Part | undefined} part
 * @param {{ sequences?: Map<string, string[]> | null, ucv?: import('./ucv.js').UcvIndex | null, variants?: boolean }} [known]
 *   `variants` also offers the forms no code point names that a source draws, written with a
 *   variant identifier.
 * @returns {ComponentForm[]}
 */
export function componentForms(part, { sequences = null, ucv = null, variants = false } = {}) {
  if (typeof part !== 'string') return []
  const base = variationBase(variantOf(part).base)
  if (base === null) return []
  /** @type {ComponentForm[]} */
  const forms = [{ write: base, kind: 'plain' }]
  const seen = new Set([base])
  /** @param {ComponentForm} form */
  const add = form => { if (!seen.has(form.write)) { seen.add(form.write); forms.push(form) } }
  for (const sequence of sequences?.get(base) ?? []) add({ write: sequence, kind: 'sequence' })
  for (const entry of ucv?.formsOf(base) ?? []) {
    const unifiable = entry.kind === 'unifiable'
    entry.forms.forEach((form, at) => {
      const listed = { entry: entry.id, unifiable, form: at + 1, glyph: form.glyph }
      if (form.text) {
        // A slot in the text is a place in a character, which a component alone cannot be written as.
        if (form.text.includes('⬚')) return
        add({ write: form.text, kind: variationBase(form.text) === base ? 'sequence' : 'sibling', ...listed })
      } else if (variants && unifiable && !form.undrawn) {
        const id = ucvIdentifier(entry.id, at + 1, entry.forms.length)
        if (id) add({ write: base + id, kind: 'variant', ...listed })
      }
    })
  }
  return forms.length > 1 ? forms : []
}

/** The form among `forms` a component is written as, or undefined. @param {ComponentForm[]} forms @param {string} part */
export const writtenForm = (forms, part) => {
  const written = variationOf(part)
  return forms.find(form => form.write === written)
}

/**
 * What a composer draws for a component whose variant identifier names an entry form: the form's
 * glyph reference where no text writes it and a source draws it, the form itself where it is one
 * character or variation sequence, else null (a description, or a form nothing draws).
 * @param {import('./ucv.js').UcvIndex} ucv @param {string} part
 * @returns {string | null}
 */
export function drawnForm(ucv, part) {
  const found = ucvFormOf(ucv, part)
  if (!found || found.form.undrawn) return null
  if (!found.form.text) return glyphReference(found.form.glyph)
  return variationBase(found.form.text) !== null ? found.form.text : null
}

/**
 * A description as a composer draws its forms: each component whose variant identifier names an
 * entry form is written as what draws that form (`drawnForm`), and every other identifier is
 * dropped, since one glyph is drawn for each. `formed` says whether any component was written
 * as its form, where the drawing is no longer that of the characters alone.
 * @param {import('./ids.js').Part} tree @param {import('./ucv.js').UcvIndex | null} ucv
 * @returns {{ tree: import('./ids.js').Part, formed: boolean }}
 */
export function formedTree(tree, ucv) {
  let formed = false
  /** @param {import('./ids.js').Part} part @returns {import('./ids.js').Part} */
  const walk = part => {
    if (isNode(part)) return { ...part, parts: part.parts.map(walk) }
    if (part === null) return null
    const { base, variant } = variantOf(part)
    if (!variant) return part
    const drawn = ucv ? drawnForm(ucv, part) : null
    if (!drawn) return base
    formed = true
    return drawn + base.slice(variationOf(base).length)
  }
  return { tree: walk(tree), formed }
}

/**
 * A description, or one component with its variant identifier (壬q0012 alone, which is no
 * description), as a composer draws its forms: the text of `formedTree`'s answer, or null where no
 * component is written as a glyph reference.
 * @param {string} text @param {import('./ucv.js').UcvIndex | null} ucv
 * @returns {string | null}
 */
export function formedText(text, ucv) {
  const read = parse(text, { open: true })
  const alone = variantOf(text)
  const tree = !read.problem && read.tree !== null && read.tree !== undefined ? read.tree
    : alone.variant && variationBase(alone.base) !== null ? text : null
  if (tree === null) return null
  const shaped = formedTree(tree, ucv)
  return shaped.formed ? write(shaped.tree) : null
}
