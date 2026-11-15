// @ts-check
// Identifiers for the forms no code point names. One form has one number, minted once and kept:
// `&X-00053;` reads as a component wherever a description is read. The number says nothing about
// the form; what a form is called and what it resembles is recorded beside it.
//
// The ledger (`data/custom-ids.tsv`) is append-only. A form keeps the number its first name was
// given. Two numbers found to be one form keep the lower and retire the other with a note; a form
// split in two keeps its number on the side that holds its first name and the other side is minted
// anew. A retired number is never given out again.

/** The first private-use scalar of plane 15; form n is drawn at this plus n. */
export const SCALAR_BASE = 0xf0000

/** @param {number} n @returns {string} The identifier of form n, without the entity marks. */
export const formId = n => `X-${String(n).padStart(5, '0')}`
/** @param {string} id @returns {string} The identifier as a description writes it. */
export const formEntity = id => `&${id};`
/** @param {string} id @returns {number} */
export const formNumber = id => Number(/^X-(\d+)$/.exec(id)?.[1] ?? NaN)
/** @param {string} id @returns {string} The private-use character of a form. */
export const formChar = id => String.fromCodePoint(SCALAR_BASE + formNumber(id))

/**
 * @typedef {{ id: string, alias: string, since: string, note: string }} LedgerRow A name a form is
 * known by. `note` is `first` on the name the number was minted for, `merged into X-…` or
 * `withdrawn` on a retired number, else empty.
 */

/** @param {string} text @returns {LedgerRow[]} */
export function readLedger(text) {
  return text.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const [id, alias = '', since = '', note = ''] = line.split('\t')
    return { id, alias, since, note }
  })
}

/** @param {LedgerRow[]} rows @returns {string} */
export function writeLedger(rows) {
  return ['# Forms no code point names: identifier, a name it is known by, since when, note.',
    '# Append-only; see scripts/lib/custom-ids.mjs and docs/custom-components.md.',
    ...rows.map(row => [row.id, row.alias, row.since, row.note].join('\t'))].join('\n') + '\n'
}

/**
 * The ledger brought up to the forms found now.
 * @param {{ first: string, aliases: string[] }[]} forms Each form's names, the one a new number
 * would be minted for first; in the order new numbers are given out. A name belongs to one form.
 * @param {LedgerRow[]} prior @param {string} today
 * @returns {{ rows: LedgerRow[], idOf: Map<string, string> }}
 */
export function assignIds(forms, prior, today) {
  const retired = prior.filter(row => row.note.startsWith('merged into') || row.note === 'withdrawn')
  const gone = new Set(retired.map(row => row.id))
  const live = prior.filter(row => !gone.has(row.id))
  /** @type {Map<string, string>} */ const firstOf = new Map()
  /** @type {Map<string, LedgerRow>} */ const was = new Map()
  for (const row of live) { if (row.note === 'first') firstOf.set(row.alias, row.id); was.set(row.alias, row) }
  let next = Math.max(0, ...prior.map(row => formNumber(row.id)).filter(Number.isFinite)) + 1
  /** @type {LedgerRow[]} */ const rows = []
  /** @type {Map<string, string>} */ const idOf = new Map()
  const kept = new Set()
  for (const form of forms) {
    const held = [...new Set(form.aliases.map(alias => firstOf.get(alias)).filter(id => id !== undefined))]
      .sort((a, b) => formNumber(/** @type {string} */ (a)) - formNumber(/** @type {string} */ (b)))
    const id = /** @type {string} */ (held[0] ?? formId(next++))
    const first = held.length ? /** @type {string} */ ([...firstOf].find(([, held]) => held === id)?.[0]) : form.first
    kept.add(id)
    for (const other of held.slice(1)) { kept.add(other); retired.push({ id: /** @type {string} */ (other), alias: '', since: today, note: `merged into ${id}` }) }
    for (const alias of form.aliases) {
      const before = was.get(alias)
      rows.push({ id, alias, since: before?.id === id ? before.since : today, note: alias === first ? 'first' : '' })
      idOf.set(alias, id)
    }
  }
  // A number whose first name no form holds any more is withdrawn, its name kept for the record.
  for (const [alias, id] of firstOf) if (!kept.has(id)) retired.push({ id, alias, since: today, note: 'withdrawn' })
  const all = [...rows, ...retired].sort((a, b) => formNumber(a.id) - formNumber(b.id) || Number(b.note === 'first') - Number(a.note === 'first') || (a.alias < b.alias ? -1 : a.alias > b.alias ? 1 : 0))
  return { rows: all, idOf }
}
