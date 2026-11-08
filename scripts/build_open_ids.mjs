// Build data/open-data: the IDS descriptions this project transcribed or read, with a citation for
// each, as a release a reader can reuse without this package. The design is described in the
// README the build writes beside the tables.
//
//   bun scripts/build_open_ids.mjs [--check]
//
// The descriptions come from the starter catalogue (demo/lib/examples.js), the citations from its
// source records (demo/lib/example-sources.js), and the numbered components from
// data/ids-components.tsv. A row that is a character alone is not a description and is left out.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { OPERATORS, parse } from '../src/core/ids.js'
import { EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { EXAMPLE_SOURCES } from '../demo/lib/example-sources.js'

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const OUT = new URL('../data/open-data/', import.meta.url)
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

const OPERATOR = new Set(OPERATORS.map(([operator]) => operator))
const EDITORIAL_SOURCE = /\/ids\.json$/
const SOURCE_STATUS = new Set(['checked', 'reported', 'personal'])
// The two numbered components whose fragments are this project's reading, not IDS.TXT's note 6.
const EDITORIAL_COMPONENTS = new Set(['{12}', '{82}'])

const en = JSON.parse(await read('../demo/messages/en.json'))
const examples = EXAMPLE_GROUPS.flatMap(group => group.examples.map(example => ({ example, group })))

/** The group's English name, which the site shows beside the same records. @param {string} key */
const groupTitle = key => {
  const title = en[`app.examples.${key}`]
  if (!title) throw new Error(`No English title for the group ${key}`)
  return title
}

/** The citation keys behind one example, from its own refs or its group's. @param {{ refs?: number[] }} example @param {number[] | undefined} groupRefs */
const citationKeys = (example, groupRefs) => (example.refs ?? groupRefs ?? []).map(number => {
  const source = EXAMPLE_SOURCES[number - 1]
  if (!source) throw new Error(`No source record ${number} for ${example.sequence}`)
  return source.id
})

/** @param {string} char */
const codepoint = char => char ? `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}` : null

const records = []
for (const group of EXAMPLE_GROUPS) {
  for (const example of group.examples) {
    // A row whose text is the character alone names a form, not an arrangement of parts.
    if (![...example.sequence].some(char => OPERATOR.has(char))) continue
    if (!parse(example.sequence, { open: true }).tree) throw new Error(`Unparsable description ${example.sequence}`)
    if ([...example.char].length > 1) throw new Error(`More than one character in ${example.sequence}: ${example.char}`)
    records.push({
      ids: example.sequence,
      char: example.char || null,
      codepoint: codepoint(example.char),
      group: group.key,
      reading: example.reading ?? null,
      modern: example.modern ?? null,
      abbreviates: example.abbreviates ?? null,
      editorial: Boolean(example.source?.match(EDITORIAL_SOURCE)),
      sources: citationKeys(example, group.refs),
    })
  }
}

const duplicate = records.find((record, index) => records.findIndex(other => other.ids === record.ids && other.char === record.char) !== index)
if (duplicate) throw new Error(`Duplicate description ${duplicate.ids}`)

// The sources the records cite, in catalogue order. A source nobody cites is left out rather than
// carried as an unused record.
const cited = new Set(records.flatMap(record => record.sources))
const sources = EXAMPLE_SOURCES
  .filter(source => cited.has(source.id))
  .map(source => {
    if (!SOURCE_STATUS.has(source.status)) throw new Error(`Unknown status ${source.status} on ${source.id}`)
    return {
      key: source.id,
      title: source.title,
      ...(source.author ? { author: source.author } : {}),
      ...(source.date ? { date: source.date } : {}),
      ...(source.url ? { url: source.url } : {}),
      status: source.status,
      note: source.note,
    }
  })
const known = new Set(sources.map(source => source.key))
for (const record of records) {
  for (const key of record.sources) if (!known.has(key)) throw new Error(`Uncited source ${key}`)
}

const components = (await read('../data/ids-components.tsv'))
  .split('\n')
  .filter(line => line && !line.startsWith('#'))
  .map(line => {
    const [component, description, fragment = ''] = line.split('\t')
    return { component, description, fragment, editorial: EDITORIAL_COMPONENTS.has(component) }
  })

const groups = EXAMPLE_GROUPS
  .map(group => ({
    key: group.key,
    title: groupTitle(group.key),
    count: records.filter(record => record.group === group.key).length,
    unencoded: records.filter(record => record.group === group.key && !record.char).length,
  }))
  .filter(group => group.count > 0)

const counts = {
  descriptions: records.length,
  unencoded: records.filter(record => !record.char).length,
  editorial: records.filter(record => record.editorial).length,
  groups: groups.length,
  sources: sources.length,
  components: components.length,
}

const licence = {
  spdx: 'CC0-1.0',
  url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  note: 'The descriptions, their arrangement and the editorial readings are public domain. Each record cites its source, and the cited works keep their own terms.',
}

const dataset = {
  format: 'ids-input/open-ids',
  version: 1,
  licence,
  counts,
  groups,
  sources,
  records,
  components,
}

/** @param {string} text */
const tsvCell = text => text.replaceAll('\t', ' ').replaceAll('\n', ' ')
/** @param {(string | null)[]} cells */
const tsvLine = cells => cells.map(cell => tsvCell(cell ?? '')).join('\t')

const descriptionsTsv = [
  tsvLine(['ids', 'char', 'codepoint', 'group', 'reading', 'modern', 'abbreviates', 'editorial', 'sources']),
  ...records.map(record => tsvLine([
    record.ids, record.char, record.codepoint, record.group, record.reading, record.modern,
    record.abbreviates, String(record.editorial), record.sources.join(' '),
  ])),
].join('\n') + '\n'

const componentsTsv = [
  tsvLine(['component', 'description', 'fragment', 'editorial']),
  ...components.map(component => tsvLine([
    component.component, component.description, component.fragment, String(component.editorial),
  ])),
].join('\n') + '\n'

const json = JSON.stringify(dataset, null, 2) + '\n'

/** A table cell, with the pipes and newlines Markdown would take for structure. @param {string} text */
const cell = text => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

const sourceRows = sources.map(source => `| \`${source.key}\` | ${cell(source.title)} | ${cell(source.author ?? '—')} | ${source.date ?? '—'} | ${source.status} | ${source.url ? `<${source.url}>` : '—'} |`).join('\n')
const groupRows = groups.map(group => `| ${cell(group.title)} | \`${group.key}\` | ${group.count} | ${group.unencoded} |`).join('\n')

const readme = `# Open IDS descriptions

The ideographic description sequences IDS Input transcribed or read, with the source behind each
one. The release holds ${counts.descriptions} descriptions in ${counts.groups} groups, ${counts.unencoded} of them
for characters with no code point, and is released under CC0 1.0.

The format is \`ids-input/open-ids\`, version 1.

## Files

| File | |
| --- | --- |
| \`descriptions.json\` | The dataset: metadata, sources, records and numbered components. |
| \`descriptions.tsv\` | The records as a table, one row per description. |
| \`components.tsv\` | BabelStone's 121 numbered components, with the fragment that writes each out. |
| \`manifest.json\` | Counts and file sizes, read by the site page. |

## Records

| Field | |
| --- | --- |
| \`ids\` | The description, as the source writes it. |
| \`char\` | The character it describes, empty when it has no code point. |
| \`codepoint\` | \`char\` written \`U+XXXX\`. |
| \`group\` | The section the description appears in, listed below. |
| \`reading\` | The reading given for the character or form: Hangul for gukja, romanization for Nôm and Jurchen, kana for kokuji. |
| \`modern\` | The modern Han character a seal or Shuishu form corresponds to. |
| \`abbreviates\` | The standard character a Geba form stands for. |
| \`editorial\` | \`true\` where the description is the project's reading of the glyph; the sources still name the glyph. |
| \`sources\` | Keys into the \`sources\` table. |

A description is a source's account of one form, not an absolute glyph. The same character can carry
several descriptions, each with the regions or reading that account belongs to.

## Groups

| Group | Key | Descriptions | No code point |
| --- | --- | ---: | ---: |
${groupRows}

## Sources

Each record cites the works behind it, and \`descriptions.json\` keeps a note on what each work
gives. \`checked\` marks a source read directly, \`reported\` one known from a second-hand
statement, and \`personal\` a personal communication.

Two records, ⿰言⿱⿰幺幺⿰幺幺 and ⿱車🚗, carry no recorded source; their \`sources\` lists are empty.

| Key | Work | Author | Date | Status | URL |
| --- | --- | --- | --- | --- | --- |
${sourceRows}

## Licence

[CC0 1.0 Universal](${licence.url}). The descriptions, their arrangement and the editorial readings
are dedicated to the public domain. Each record cites the source it came from; the cited works keep
their own terms.

## Rebuild

\`bun scripts/build_open_ids.mjs\` rewrites these files. Add \`--check\` to fail when a committed
file differs.

The source data is \`demo/lib/examples.js\`, \`demo/lib/example-sources.js\` and
\`data/ids-components.tsv\`.

## Cite

IDS Input. Open IDS descriptions, version 1. <https://ids.mkpo.li/open-data>
`

const text = { 'descriptions.json': json, 'descriptions.tsv': descriptionsTsv, 'components.tsv': componentsTsv, 'README.md': readme }
const manifest = {
  format: dataset.format,
  version: dataset.version,
  licence,
  counts,
  groups,
  files: [
    { name: 'descriptions.json', bytes: Buffer.byteLength(json), type: 'application/json' },
    { name: 'descriptions.tsv', bytes: Buffer.byteLength(descriptionsTsv), type: 'text/tab-separated-values' },
    { name: 'components.tsv', bytes: Buffer.byteLength(componentsTsv), type: 'text/tab-separated-values' },
    { name: 'README.md', bytes: Buffer.byteLength(readme), type: 'text/markdown' },
  ],
}
text['manifest.json'] = JSON.stringify(manifest, null, 2) + '\n'

if (CHECK) {
  let changed = false
  for (const [name, content] of Object.entries(text)) {
    let committed = ''
    try { committed = await readFile(new URL(name, OUT), 'utf8') } catch {}
    if (committed !== content) {
      console.error(`data/open-data/${name} is stale`)
      changed = true
    }
  }
  if (changed) process.exit(1)
  console.log(`open data: ${counts.descriptions} descriptions, ${counts.sources} sources, unchanged`)
} else {
  await mkdir(OUT, { recursive: true })
  for (const [name, content] of Object.entries(text)) await writeFile(new URL(name, OUT), content)
  console.log(`open data: ${counts.descriptions} descriptions, ${counts.sources} sources, ${counts.components} components`)
}
