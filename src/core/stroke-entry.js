// @ts-check
// A stroke order entered by hand: one row of `data/stroke-orders-entered.tsv`. The build that
// publishes the rows, the page they are entered on and the dev server that writes them share these
// rules, so a row the page accepts is one the build accepts.

/** The symbols each source's orders are written in: one code per way, a space between ways. */
export const ENTRY_SYMBOLS = /** @type {Record<string, RegExp>} */ ({
  cns11643: /^[1-5]+( [1-5]+)*$/, kanjivg: /^[1-5]+( [1-5]+)*$/, 'rime-stroke': /^[hspnz]+( [hspnz]+)*$/,
})
/** The columns of a row, in the file's order. */
export const ENTRY_COLUMNS = /** @type {const} */ (['char', 'source', 'orders', 'basis', 'by', 'date'])

/** @typedef {{ char: string, source: string, orders: string, basis: string, by: string, date: string }} StrokeEntry */

/**
 * What is wrong with a row, as the name of the field at fault, or null when the build takes it. A
 * component can be a CJK stroke or a letter a description borrows, so any one character is taken.
 * @param {Partial<StrokeEntry>} entry
 * @returns {'char' | 'source' | 'orders' | 'basis' | 'by' | 'date' | null}
 */
export function entryProblem(entry) {
  // `#` opens a comment line of the file, so a row cannot begin with it.
  if ([...(entry.char ?? '')].length !== 1 || /[\s#]/.test(entry.char ?? '')) return 'char'
  if (!ENTRY_SYMBOLS[entry.source ?? '']) return 'source'
  if (!ENTRY_SYMBOLS[entry.source ?? ''].test(entry.orders ?? '')) return 'orders'
  // A tab or a line break would split the row.
  if (!entry.basis?.trim() || /[\t\n\r]/.test(entry.basis)) return 'basis'
  if (!entry.by?.trim() || /[\t\n\r]/.test(entry.by)) return 'by'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '')) return 'date'
  return null
}

/** A row as the file writes it. @param {StrokeEntry} entry */
export const entryLine = entry => ENTRY_COLUMNS.map(column => entry[column]).join('\t')

/**
 * The rows of the file's text, comment lines left out. A row the build would refuse, or a
 * character entered twice for one source, throws with the line it stands on.
 * @param {string} text @param {string} [name] The file's name, for the error.
 * @returns {StrokeEntry[]}
 */
export function parseEntries(text, name = 'data/stroke-orders-entered.tsv') {
  /** @type {StrokeEntry[]} */
  const entries = []
  for (const [index, line] of text.split('\n').entries()) {
    if (!line || line.startsWith('#')) continue
    const [char, source, orders, basis, by, date] = line.split('\t')
    const entry = { char, source, orders, basis, by, date }, problem = entryProblem(entry)
    if (problem) throw Error(`${name}:${index + 1}: ${problem}`)
    if (entries.some(other => other.char === char && other.source === source)) throw Error(`${name}:${index + 1}: ${char} is entered twice for ${source}`)
    entries.push(entry)
  }
  return entries
}

/**
 * The file's text with `entry` in it: in place of the row for the same character and source, else
 * at the end. Comment lines stay where they are.
 * @param {string} text @param {StrokeEntry} entry
 */
export function withEntry(text, entry) {
  const lines = text.replace(/\n$/, '').split('\n')
  const at = lines.findIndex(line => !line.startsWith('#') && line.split('\t')[0] === entry.char && line.split('\t')[1] === entry.source)
  if (at >= 0) lines[at] = entryLine(entry); else lines.push(entryLine(entry))
  return lines.join('\n') + '\n'
}

/** The file's text without the row for a character and source. @param {string} text @param {string} char @param {string} source */
export function withoutEntry(text, char, source) {
  return text.replace(/\n$/, '').split('\n').filter(line => line.startsWith('#') || line.split('\t')[0] !== char || line.split('\t')[1] !== source).join('\n') + '\n'
}
