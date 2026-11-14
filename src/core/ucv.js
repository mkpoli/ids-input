// @ts-check
// The IRG's unifiable (UCV) and non-unifiable (NUCV) component variations, as compiled in
// `data/ucv.json`: which entries a character belongs to, and which entries a query asks for.

/**
 * @typedef {object} UcvForm
 * @property {string} glyph The GlyphWiki glyph the source names for the form.
 * @property {string} [text] The form as text: a character, a description, or a character and its variation selector.
 * @property {string} [of] The character a named form belongs to, when the form itself has no text.
 * @property {boolean} [undrawn] No source draws the form.
 */

/**
 * @typedef {object} UcvEntry
 * @property {string} id The entry number, with its letter (`8a`).
 * @property {'unifiable' | 'not-unifiable'} kind
 * @property {number} [level]
 * @property {string} group
 * @property {UcvForm[]} forms
 * @property {string} [components]
 * @property {string} [jis] The JIS X 0213 unification criterion.
 * @property {string} [jisx0212]
 * @property {string} [hydcd] The Hanyu Da Cidian new and old form number.
 * @property {string} [annexS] The clause of ISO/IEC 10646 Annex S.
 * @property {string[]} [unified]
 * @property {boolean} [unifiedMore] The source ends the unified list with an ellipsis.
 * @property {string[][]} [compatibility] Pairs of a unified ideograph and its compatibility ideograph.
 * @property {string[][]} [disunified] Groups of characters coded apart.
 * @property {string[][]} [sourceSeparations] Groups kept apart by the source separation rule.
 * @property {{ char?: string, glyph?: string, examples: string[], count?: string }[]} [single] A character that keeps one form, and the characters it appears in.
 * @property {string} [note]
 * @property {string} [references]
 * @property {string[]} [review]
 * @property {Record<string, string>} [charts]
 */

/**
 * @typedef {object} UcvData
 * @property {{ id: string, en: string, subgroups: { id: string, en: string }[] }[]} groups
 * @property {UcvEntry[]} entries
 */

/** A character without its variation selector. @param {string} text */
const bare = text => [...text].filter(char => !/[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/u.test(char)).join('')

/**
 * The characters an entry's forms are, and the example characters it lists.
 * @param {UcvEntry} entry
 * @returns {{ forms: Set<string>, examples: Set<string> }}
 */
export function entryCharacters(entry) {
  /** @type {Set<string>} */
  const forms = new Set()
  for (const form of entry.forms) {
    if (form.text) forms.add(bare(form.text))
    if (form.of) forms.add(form.of)
  }
  /** @type {Set<string>} */
  const examples = new Set(entry.unified ?? [])
  for (const group of [...entry.compatibility ?? [], ...entry.disunified ?? [], ...entry.sourceSeparations ?? []]) {
    for (const char of group) examples.add(char)
  }
  for (const single of entry.single ?? []) {
    if (single.char) examples.add(single.char)
    for (const char of single.examples) examples.add(char)
  }
  return { forms, examples }
}

/**
 * @typedef {object} UcvIndex
 * @property {UcvEntry[]} entries
 * @property {(query: string, options?: { kind?: UcvEntry['kind'] | null }) => UcvEntry[]} find
 *   The entries a query asks for: an entry number (with or without its letters), or any of its
 *   characters as a form or an example. An entry with the whole query as a form comes first, then
 *   those with one of its characters as a form; an empty query gives every entry in the source's order.
 * @property {(char: string) => UcvEntry[]} formsOf The entries one of whose forms is `char`.
 */

/**
 * @param {UcvData} data
 * @returns {UcvIndex}
 */
export function createUcvIndex(data) {
  const entries = data.entries
  const characters = entries.map(entryCharacters)
  /** @type {Map<string, number[]>} */
  const byForm = new Map()
  characters.forEach(({ forms }, index) => {
    for (const char of forms) byForm.set(char, [...byForm.get(char) ?? [], index])
  })
  return {
    entries,
    find(query, { kind = null } = {}) {
      // An entry number may be typed full-width; characters are compared as written.
      const typed = query.trim(), folded = typed.normalize('NFKC')
      const asked = /^\d+[a-z]*$/i.test(folded) ? folded : typed
      const kept = (/** @type {UcvEntry} */ entry) => !kind || entry.kind === kind
      if (!asked) return entries.filter(kept)
      if (/^\d+[a-z]*$/i.test(asked)) {
        const id = asked.toLowerCase().replace(/^0+(?=\d)/, '')
        return entries.filter(entry => kept(entry) && (entry.id === id || entry.id.replace(/[a-z]+$/, '') === id))
      }
      const wanted = [...new Set([...bare(asked)].filter(char => !/\s/u.test(char)))]
      const whole = bare(asked)
      /** @type {{ entry: UcvEntry, score: number, index: number }[]} */
      const hits = []
      entries.forEach((entry, index) => {
        if (!kept(entry)) return
        const { forms, examples } = characters[index]
        const score = forms.has(whole) ? 3 : wanted.some(char => forms.has(char)) ? 2 : wanted.some(char => examples.has(char)) ? 1 : 0
        if (score) hits.push({ entry, score, index })
      })
      return hits.sort((a, b) => b.score - a.score || a.index - b.index).map(hit => hit.entry)
    },
    formsOf: char => (byForm.get(bare(char)) ?? []).map(index => entries[index]),
  }
}
