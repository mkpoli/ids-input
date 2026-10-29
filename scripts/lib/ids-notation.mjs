// @ts-check
// What zi.tools notation a description carries, read from its text alone. The parser may read some
// of it; this only names what is written, so a coverage report can say which notation is still
// unread rather than which text happens to fail.

/** The operators zi.tools writes a modifier after: an overlay's matrix, an enclosure's or a
 * subtraction's index. Kept in step with `src/core/ids.js`. */
const MODIFIABLE = '⿻⿴⿵⿶⿷⿼㇯'
/** A modifier's contents: digits, signs, dots, matrix letters, commas and the column separator. */
const MODIFIER = /[0-9:,._xabcdlr|-]+/
/** A stroke chain: `#(` strokes `)`. */
const CHAIN = /#\([^)]*\)/u
/** A zi.tools entry's unique separator before the description: `{曰}`, `{?0丗}`, `{𡮂J}`. */
const SEPARATOR = /^\{(?:\?[0-9]?)?[^}]+\}/u
/** A zi.tools entry's glyph-variant definition after the description: `(.,T)`, `(d)`. */
const DEFINITION = /\([0-9A-Za-z.,]+\)\s*$/u

/** @typedef {'plain' | 'note' | 'modifier' | 'chain' | 'note+modifier' | 'note+chain' | 'modifier+chain' | 'note+modifier+chain'} Notation */

/**
 * What is written in `text`: a plain description, an entry's notes, an operator's modifier, a
 * stroke chain, or a combination joined with `+`.
 * @param {string} text @returns {Notation}
 */
export function notation(text) {
  const written = text ?? ''
  /** @type {string[]} */
  const found = []
  if (SEPARATOR.test(written) || DEFINITION.test(written)) found.push('note')
  const modifier = new RegExp(`[${MODIFIABLE}]\\[${MODIFIER.source}\\]`, 'u')
  if (modifier.test(written)) found.push('modifier')
  if (CHAIN.test(written)) found.push('chain')
  return /** @type {Notation} */ (found.length ? found.join('+') : 'plain')
}

/** Every sequence in a level-1 table's text: each row is a character and its descriptions, the
 * descriptions separated by `;` and spaces. @param {string} text @returns {string[]} */
export function sequences(text) {
  /** @type {string[]} */
  const out = []
  for (const row of (text ?? '').split('\n')) {
    if (!row || row.startsWith('#')) continue
    const [, ...columns] = row.split('\t')
    for (const column of columns) for (const part of column.split(';')) {
      const written = part.trim()
      if (written) out.push(written)
    }
  }
  return out
}
