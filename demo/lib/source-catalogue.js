// The catalogue the Sources page renders: every top-level source, followed by the records behind
// the starter examples. The records keep their citation numbers and notes in example-sources.js;
// this module only gives them the fields the catalogue needs.
import { EXAMPLE_SOURCES } from './example-sources.js'
import { EXAMPLE_GROUPS } from './examples.js'
import { SOURCES } from './sources.js'

/** @typedef {import('./sources.js').Source & { number?: number }} Source */

/** Tags a record earns from what it is, beside `example`. @param {{ id: string, url?: string }} record */
function recordTags(record) {
  const tags = []
  if (record.id.startsWith('x-')) tags.push('social')
  if (/wikipedia\.org/.test(record.url ?? '')) tags.push('wikipedia')
  if (/^(?:irg-|n2572)/.test(record.id)) tags.push('irg')
  if (record.id.startsWith('l2-')) tags.push('unicode')
  return tags
}

/** The starter examples that cite each record, by the record's number. @type {Map<number, { sequence: string, char: string }[]>} */
const CITATIONS = new Map()
for (const group of EXAMPLE_GROUPS) for (const example of group.examples) {
  for (const number of example.refs ?? group.refs ?? []) {
    if (!CITATIONS.has(number)) CITATIONS.set(number, [])
    CITATIONS.get(number).push({ sequence: example.sequence, char: example.char })
  }
}

/** @type {Source[]} */
export const RECORDS = EXAMPLE_SOURCES.map((record, index) => ({
  id: `example-${record.id}`,
  category: 'examples',
  tags: recordTags(record),
  title: record.title,
  people: record.author ? [record.author] : [],
  url: record.url,
  date: record.date,
  status: record.status,
  usedIn: ['examples'],
  citedBy: CITATIONS.get(index + 1) ?? [],
  note: record.note,
  number: index + 1,
}))

/** @type {Source[]} */
export const CATALOGUE = [...SOURCES, ...RECORDS]
