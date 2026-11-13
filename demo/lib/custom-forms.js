// @ts-check
// The appendix's table: one row per form no code point names, gathered from
// `data/custom-components.json.gz`, and the test a query puts to a row.
import { customKind, customLength, isCustom } from '../../src/core/index.js'

/**
 * @typedef {'babelstone' | 'chise' | 'zi-tools'} Notation
 * @typedef {{ text: string, source: Notation | 'unnamed', description?: string }} FormName
 * @typedef {{ in: Notation, text: string, status: 'confirmed' | 'candidate', count: number, characters: string[], id?: string }} FormEquivalent
 * @typedef {{ char: string, text: string, in: Notation, of: string, status: string }} FormDerived
 * @typedef {object} FormRow
 * @property {string} id The form's identifier, X-00053.
 * @property {number} number
 * @property {string} shown What is drawn for it: a name, or its expression.
 * @property {FormName[]} names
 * @property {{ id: string, relation: 'confirmed' | 'candidate' | 'arrangement' }[]} of The forms an unnamed one was found for.
 * @property {FormEquivalent[]} equivalents
 * @property {{ other: string, note: string }[]} yours
 * @property {number} uses
 * @property {string} usedIn
 * @property {FormDerived[]} derived
 * @property {'confirmed' | 'candidate' | 'none'} status
 * @property {string} hay Everything a query may match, lower case.
 */

/** A reader's pair side as the table writes it: bsp:7 as {7}, chise:CDP-8BD0 as &CDP-8BD0;, a code
 * point as its character. @param {string} cid @returns {string} */
export function sideText(cid) {
  const [scheme, rest = ''] = cid.split(/:(.*)/s)
  if (scheme === 'bsp') return `{${rest}}`
  if (scheme === 'chise') return `&${rest};`
  if (scheme === 'ucs') { const point = parseInt(rest, 16); return Number.isFinite(point) ? String.fromCodePoint(point) : cid }
  return cid
}

/**
 * @param {import('../../src/core/custom-components.js').CustomComponentsData & { characters?: (FormDerived & { ids?: string[] })[] }} doc
 * @param {{ a: string, b: string, note: string }[]} [mine]
 * @returns {FormRow[]}
 */
export function formRows(doc, mine = []) {
  const by = new Map(doc.components.map(row => [row.text, row]))
  /** @type {Map<string, FormDerived[]>} */
  const derived = new Map()
  for (const row of doc.characters ?? []) for (const id of row.ids ?? []) {
    const list = derived.get(id) ?? []
    derived.set(id, list)
    list.push({ char: row.char, text: row.text, in: row.in, of: row.of, status: row.status })
  }
  // Where an unnamed form comes from: the forms it was found for.
  /** @type {Map<string, { id: string, relation: 'confirmed' | 'candidate' | 'arrangement' }[]>} */
  const origin = new Map()
  /** @param {string | undefined} to @param {string | undefined} id @param {'confirmed' | 'candidate' | 'arrangement'} relation */
  const point = (to, id, relation) => {
    if (!to || !id || to === id) return
    const list = origin.get(to) ?? []
    origin.set(to, list)
    if (!list.some(other => other.id === id && other.relation === relation)) list.push({ id, relation })
  }
  for (const row of doc.components) for (const item of /** @type {any[]} */ (row.equivalents)) {
    if (item.basis !== 'difference') continue
    // Two forms of one source may share a confirmed expression; it is then neither's own name.
    if (!isCustom(item.text)) point(item.id, row.id, item.status === 'verified' ? 'confirmed' : 'candidate')
    for (const other of item.arrangements ?? []) point(other.id, row.id, 'arrangement')
  }
  const pairs = mine.map(pair => ({ a: sideText(pair.a), b: sideText(pair.b), note: pair.note }))
  return (doc.forms ?? []).map(form => {
    const named = form.names.flatMap(name => by.get(name) ?? [])
    /** @type {FormName[]} */
    const names = named.length
      ? named.map(row => ({ text: row.text, source: /** @type {Notation} */ (row.source), ...(row.description ? { description: row.description } : {}) }))
      : form.names.map(text => ({ text, source: /** @type {const} */ ('unnamed') }))
    /** @type {Map<string, FormEquivalent>} */
    const equal = new Map()
    for (const row of named) for (const item of /** @type {any[]} */ (row.equivalents)) {
      // Another name of this same form is listed among its names.
      if (item.id === form.id && isCustom(item.text)) continue
      const key = `${item.in}\0${item.text}`, status = item.status === 'verified' ? 'confirmed' : 'candidate'
      const seen = equal.get(key)
      // Two names of the form may give the same equivalent: the characters behind both count.
      const characters = [...new Set([...(seen?.characters ?? []), ...item.characters])]
      equal.set(key, { in: item.in, text: item.text, status: seen?.status === 'confirmed' ? 'confirmed' : status,
        count: Math.max(seen?.count ?? 0, item.count, characters.length), characters, ...(item.id ?? seen?.id ? { id: item.id ?? seen?.id } : {}) })
    }
    const equivalents = [...equal.values()].sort((a, b) => Number(b.status === 'confirmed') - Number(a.status === 'confirmed') || b.count - a.count)
    const of = origin.get(form.id) ?? []
    // A name is matched whatever its case was typed in; two pairs to one other side are one line.
    const lower = form.names.map(name => name.toLowerCase())
    /** @type {Map<string, { other: string, note: string }>} */
    const paired = new Map()
    for (const pair of pairs) {
      const other = lower.includes(pair.a.toLowerCase()) ? pair.b : lower.includes(pair.b.toLowerCase()) ? pair.a : null
      if (other === null) continue
      const seen = paired.get(other)
      paired.set(other, { other, note: [seen?.note, pair.note].filter(Boolean).join(' · ') })
    }
    const mineHere = [...paired.values()]
    const usedIn = [...new Set(named.flatMap(row => [.../** @type {string} */ (/** @type {any} */ (row).usedIn ?? row.examples.join(''))]))].join('')
    const status = named.length > 1 || equivalents.some(item => item.status === 'confirmed') || of.some(other => other.relation === 'confirmed') ? 'confirmed' : equivalents.length || of.length ? 'candidate' : 'none'
    const mentions = derived.get(form.id) ?? []
    const hay = [form.id, `&${form.id};`, ...names.flatMap(name => [name.text, name.description ?? '']),
      ...equivalents.flatMap(item => [item.text, item.characters.join(''), item.id ?? '']), ...of.map(other => other.id),
      usedIn, ...mentions.flatMap(row => [row.char, row.text]), ...mineHere.flatMap(pair => [pair.other, pair.note])].join('\n').toLowerCase()
    return {
      id: form.id, number: Number(form.id.slice(2)), shown: named.find(row => row.draw)?.text ?? form.names[0], names, of, equivalents, yours: mineHere,
      uses: [...usedIn].length, usedIn, derived: mentions, status: /** @type {FormRow['status']} */ (status), hay,
    }
  }).sort((a, b) => a.number - b.number)
}

/** A query as the terms a row must all hold: split at spaces, lower case, an identifier written
 * &X-00053; read as X-00053. @param {string} query @returns {string[]} */
export const querySummary = query => query.trim().toLowerCase().split(/\s+/u).filter(Boolean).map(term => /^&x-\d+;$/.test(term) ? term.slice(1, -1) : term)

/**
 * Whether a row answers a query.
 * @param {FormRow} row @param {string[]} terms
 * @param {'all' | Notation | 'unnamed' | 'yours'} source @param {'any' | 'confirmed' | 'candidate' | 'none'} status
 */
export function matches(row, terms, source, status) {
  if (status !== 'any' && row.status !== status) return false
  if (source === 'yours' ? !row.yours.length : source !== 'all' && !row.names.some(name => name.source === source)) return false
  return terms.every(term => row.hay.includes(term))
}

/** The notation a custom component is written in, as the table names its sources. */
const NOTATION = /** @type {const} */ ({ numbered: 'babelstone', entity: 'chise', chain: 'zi-tools' })

/**
 * A description as the runs the table writes: text as it is, and each custom component on its
 * own with its notation and, where `idOf` knows it, the form it is.
 * @param {string} text @param {(name: string) => string | undefined} idOf
 * @returns {{ text: string, source?: Notation | 'form', id?: string }[]}
 */
export function segments(text, idOf) {
  /** @type {{ text: string, source?: Notation | 'form', id?: string }[]} */
  const out = []
  for (let at = 0; at < text.length;) {
    const length = customLength(text, at)
    if (!length) {
      const char = String.fromCodePoint(/** @type {number} */ (text.codePointAt(at)))
      const last = out[out.length - 1]
      if (last && !last.source) last.text += char; else out.push({ text: char })
      at += char.length
      continue
    }
    const token = text.slice(at, at + length), kind = /** @type {'numbered'} */ (customKind(token))
    const own = /^&X-\d+;$/.test(token)
    const id = own ? token.slice(1, -1) : idOf(token)
    out.push({ text: token, source: own ? 'form' : NOTATION[kind], ...(id ? { id } : {}) })
    at += length
  }
  return out
}
