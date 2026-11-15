// Import the han2ids review desk's answers into data/glyph-ids.tsv: one reviewed description per
// printed glyph that han-input keeps as an image. Usage: bun scripts/import_glyph_ids.mjs <answers.json>
import { readFile, writeFile } from 'node:fs/promises'
import { isDescription } from '../src/core/ids.js'

/** The desk's answer codes and the verdict each becomes. */
const VERDICTS = {
  known: 'known',
  c0: 'model',
  c1: 'model',
  c2: 'model',
  custom: 'written',
  wrong: 'wrong',
  skip: 'unclear',
}
/** A han-input record: `<records file id>:<serial or source>`. */
const KEY = /^[a-z0-9_]+:[^\s:]+$/u

const path = process.argv[2]
if (!path) throw new Error('usage: bun scripts/import_glyph_ids.mjs <answers.json>')
/** @type {Record<string, { c: string, ids?: string, judged?: string, by?: string, page?: string, at?: string }>} */
const answers = JSON.parse(await readFile(path, 'utf8'))

const rows = []
const unread = []
for (const [key, answer] of Object.entries(answers)) {
  // The desk's benchmark deck reviews han2ids' own renders, not han-input glyphs.
  if (key.startsWith('han2ids-clean:')) continue
  if (!KEY.test(key)) throw new Error(`${key}: not a han-input record key`)
  const verdict = VERDICTS[answer.c]
  if (!verdict) throw new Error(`${key}: unknown answer ${answer.c}`)
  const ids = (answer.ids ?? '').trim()
  if (Boolean(ids) !== !['wrong', 'unclear'].includes(verdict)) throw new Error(`${key}: ${verdict} with ids "${ids}"`)
  if (ids && [...ids].length > 1 && !isDescription(ids)) unread.push(`${key}\t${ids}`)
  const by = verdict === 'known' ? `${answer.by ?? ''} ${answer.page ?? ''}`.trim() : verdict === 'model' ? `han2ids ${answer.c}` : ''
  rows.push([key, ids, verdict, by, answer.judged ?? '', answer.at ?? ''])
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

const lines = [
  '# Reviewed descriptions of the printed glyphs han-input keeps as images.',
  '# key<TAB>ids<TAB>verdict<TAB>by<TAB>judged<TAB>at; see data/README.md.',
  ...rows.map(row => row.join('\t')),
]
await writeFile(new URL('../data/glyph-ids.tsv', import.meta.url), lines.join('\n') + '\n')
const counts = Object.groupBy(rows, row => row[2])
console.log(`${rows.length} glyphs: ${Object.entries(counts).map(([verdict, list]) => `${list?.length} ${verdict}`).join(', ')}`)
if (unread.length) console.log(`${unread.length} descriptions the parser does not read:\n${unread.join('\n')}`)
