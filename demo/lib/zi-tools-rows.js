// The rows of yi-bai/ids for the zi.tools IDS Extension parser, from data/zi-tools-rows.tsv.gz:
// each line is a level, a TAB and that level's row, level 0 for every line of ids_lv0.txt and
// levels 1 and 2 only where they differ from the level before. Loaded once, when first asked for.
import { unpack } from '@han-compose/composer'
import { download } from '@han-compose/composer/retry'

export const REVISION = '2597437b928e8d530b7ae09cf53fe5ec7868569c'

/** A character's row at each level that writes it differently, with its line in the level's file.
 * @typedef {{ level: 0 | 1 | 2, line: number, text: string }} Row */

/**
 * The rows by character, from the pinned table's text.
 * @param {string} text
 * @returns {Map<string, Row[]>}
 */
export function indexRows(text) {
  /** @type {Map<string, Row[]>} */
  const rows = new Map()
  let line = 0
  /** @type {Row[]} */
  let current = []
  for (const one of text.split('\n')) {
    if (one.startsWith('#')) continue
    const level = /** @type {0 | 1 | 2} */ (Number(one[0]))
    const row = one.slice(2)
    if (level === 0) {
      line++
      current = []
      const head = row.slice(0, row.indexOf('\t'))
      if (head) rows.set(head, current)
    }
    if (row) current.push({ level, line, text: row })
  }
  return rows
}

/** @type {Promise<Map<string, Row[]>> | null} */
let reading = null

/** The rows by character. @returns {Promise<Map<string, Row[]>>} */
export function loadRows() {
  reading ??= download(new URL('../../data/zi-tools-rows.tsv.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('zi.tools rows')))
    .then(unpack).then(indexRows)
    .catch(error => { reading = null; throw error })
  return reading
}

/** Where a row is in its file, at the pinned commit. @param {Row} row */
export const rowSource = row => `https://github.com/yi-bai/ids/blob/${REVISION}/ids_lv${row.level}.txt#L${row.line}`
