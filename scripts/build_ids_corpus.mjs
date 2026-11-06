// Build data/ids-corpus.json.gz: one catalogue of component identities and the descriptions that
// name them, from BabelStone IDS and CHISE. Design: docs/ids-corpus.md.
//
//   bun scripts/build_ids_corpus.mjs [--out FILE] [--cache DIR] [--check]
//
// The first increment reads BabelStone and the CHISE UCS files. A CHISE entity name
// (`&GT-K01666;`) has no ontology resolution yet, so its component is a cid with a private-use form
// and its descriptions stay `unresolved`: the catalogue records the part without pretending to know
// how it is drawn.
//
// Alongside the corpus the build writes data/ids-corpus-sources.tar.gz: the CHISE inputs it read,
// their digests and the licence, so the GPL source offer does not depend on the pinned URLs.
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parse } from '../src/core/ids.js'

const args = process.argv.slice(2)
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1] }
const ROOT = new URL('../', import.meta.url).pathname
const OUT = resolve(ROOT, option('--out') ?? 'data/ids-corpus.json.gz')
const CACHE = resolve(ROOT, option('--cache') ?? 'cache/ids-corpus')
const CHECK = args.includes('--check')
const PUA_BASE = 0xf0000

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

/** One ustar header block: fixed field order, the checksum filled last, so the archive is byte-stable. */
function tarHeader(name, size) {
  const header = Buffer.alloc(512)
  const put = (at, length, value) => header.write(value, at, length, 'utf8')
  put(0, 100, name); put(100, 8, '0000644\u0000'); put(108, 8, '0000000\u0000'); put(116, 8, '0000000\u0000')
  put(124, 12, `${size.toString(8).padStart(11, '0')}\u0000`); put(136, 12, '00000000000\u0000')
  put(148, 8, '        '); put(156, 1, '0'); put(257, 6, 'ustar\u0000'); put(263, 2, '00')
  const sum = header.reduce((total, byte) => total + byte, 0)
  put(148, 8, `${sum.toString(8).padStart(6, '0')}\u0000 `)
  return header
}

/** A deterministic tar of `{ [name]: bytes }`: no timestamps, sorted names, padded to 512. */
function tar(files) {
  const blocks = []
  for (const [name, bytes] of Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))) {
    blocks.push(tarHeader(name, bytes.length), bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return Buffer.concat(blocks)
}
const text = bytes => new TextDecoder().decode(bytes)

const manifest = JSON.parse(await readFile(new URL('../data/chise-sources.json', import.meta.url)))

/** The pinned bytes of one CHISE file, fetched once and verified every run. */
async function source(entry) {
  await mkdir(CACHE, { recursive: true })
  const path = resolve(CACHE, entry.file)
  let bytes
  try { bytes = await readFile(path) } catch { bytes = null }
  if (bytes && digest(bytes) === entry.sha256) return text(bytes)
  const response = await fetch(entry.url)
  if (!response.ok) throw new Error(`${entry.file}: ${response.status}`)
  bytes = Buffer.from(await response.arrayBuffer())
  const got = digest(bytes)
  if (got !== entry.sha256) throw new Error(`${entry.file}: pinned ${entry.sha256}, fetched ${got}`)
  await writeFile(path, bytes)
  return text(bytes)
}

// A description's operator set; anything else in the text is a component.
const OPERATORS = new Set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾㇯')
const ENTITY = /&([^;]+);/g

const sources = []
const provenance = []
const sourceIndex = (entry, id) => {
  const index = provenance.length
  provenance.push({ source: id, licence: entry.licence, date: entry.date ?? '', edition: entry.edition ?? '' })
  sources.push({ id, ...entry })
  return index
}
const babelProv = sourceIndex({ title: 'BabelStone IDS', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT',
  date: '2025-06-27', edition: '2025-06-27', licence: 'Public Domain',
  sha256: digest(await readFile(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))) }, 'babelstone')
const chiseProv = manifest.files.map(entry => sourceIndex({ ...entry, licence: manifest.licence }, `chise-${entry.file}`))

/** Rows collected as (subject, text) with the provenance of the source that says it. */
const rows = []
const regions = row => row.regions ?? ''
for (const line of gunzipSync(await readFile(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString('utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, rest] = line.split('\t')
  if (!rest || [...char].length !== 1) continue
  for (const sequence of rest.split(' ')) {
    const match = sequence.match(/^([^()]+)\((.*)\)$/)
    if (!match) continue
    rows.push({ subject: char.codePointAt(0), text: match[1], regions: match[2], prov: babelProv, role: 'source' })
  }
}

for (const [i, entry] of manifest.files.entries()) {
  const content = await source(entry)
  for (const line of content.split('\n')) {
    if (!line || line.startsWith(';;')) continue
    const fields = line.split('\t')
    // CHISE writes a character as `U+4E00` in some files and `U-0002A700` in others; both name it.
    if (fields.length < 3 || !/^U[+-][0-9A-F]+$/i.test(fields[0]) || [...fields[1]].length !== 1) continue
    rows.push({ subject: fields[1].codePointAt(0), text: fields[2], regions: '', prov: chiseProv[i], role: 'source' })
  }
}

// Component identities: every entity name CHISE uses that no codepoint covers.
const components = []
const aliases = []
const byName = new Map()
let nextSlot = 0
const entityNames = new Set()
for (const row of rows) for (const [, name] of row.text.matchAll(ENTITY)) entityNames.add(name)
for (const name of [...entityNames].sort()) {
  const cid = `chise:${name}`
  const char = PUA_BASE + nextSlot++
  byName.set(name, { cid, char })
  components.push([cid, `U+${char.toString(16).toUpperCase()}`, 'unencoded', 'u', null, 0, null, false, null])
  aliases.push([cid, 'chise', name, chiseProv[0], 'name', 'glyph', 'verified'])
  aliases.push([cid, 'char', `U+${char.toString(16).toUpperCase()}`, chiseProv[0], 'codepoint', 'character', 'verified'])
}

/** The canonical text of a row: entity names rewritten to their cid token. */
const resolvedOf = value => {
  let changed = false
  const out = value.replace(ENTITY, (_, name) => { changed = true; return `&chise:${name};` })
  return changed ? out : null
}
const statusOf = (value, resolved) => {
  if (resolved) return 'unresolved'
  if (![...value].some(ch => OPERATORS.has(ch))) return 'empty'
  if ([...value].some(ch => ENTITY.test(ch))) return 'unresolved'
  return 'ready'
}

const seen = new Map()
for (const row of rows) {
  const key = `${row.subject}\0${row.text}\0${regions(row)}\0${row.role}`
  const found = seen.get(key)
  if (found) { if (!found.prov.includes(row.prov)) found.prov.push(row.prov); continue }
  const resolved = resolvedOf(row.text)
  seen.set(key, {
    subject: `ucs:${row.subject.toString(16).toUpperCase()}`, text: row.text, resolved,
    prov: [row.prov], regions: regions(row), role: row.role, status: statusOf(row.text, resolved),
  })
}
const descriptions = [...seen.values()]
  .sort((a, b) => a.subject.localeCompare(b.subject) || a.text.localeCompare(b.text))
  .map(row => [row.subject, row.text, row.resolved, row.prov, row.regions, row.role, row.status])

const corpus = {
  format: 'ids-input/ids-corpus',
  version: 1,
  licence: { spdx: manifest.licence, perSource: true,
    note: 'Every description here is a source row: the CHISE ones are GPL-2.0-or-later by CHISE-IDS'
      + ' (MORIOKA Tomohiko and contributors), the BabelStone ones are public domain. The CHISE rows'
      + ` were converted to cids and merged with BabelStone on ${manifest.retrieved}.`
      + ' data/COPYING-chise-ids.txt is the text; data/ids-corpus-sources.tar.gz holds the sources.' },
  pua: { base: PUA_BASE, next: nextSlot },
  sources,
  provenance,
  components: { columns: ['cid', 'char', 'type', 'class', 'label', 'uses', 'strokes', 'strokesDerived', 'first'], rows: components },
  aliases: { columns: ['cid', 'ns', 'value', 'prov', 'basis', 'scope', 'status'], rows: aliases },
  equivalences: { columns: ['a', 'b', 'basis', 'status', 'prov', 'note'], rows: [] },
  merges: { columns: ['kept', 'absorbed', 'basis', 'prov', 'note'], rows: [] },
  descriptions: { columns: ['subject', 'text', 'resolved', 'prov', 'regions', 'role', 'status'], rows: descriptions },
  counts: {
    descriptions: descriptions.length,
    components: components.length,
    unresolved: descriptions.filter(row => row[6] === 'unresolved').length,
    ready: descriptions.filter(row => row[6] === 'ready').length,
  },
}

// Every ready row must parse with the parser the composer uses; an unresolved row is not parsed,
// since its entity token stands for a part the catalogue has no form for yet.
for (const [subject, value, , , , , status] of descriptions) {
  if (status !== 'ready') continue
  try { parse(value) } catch (error) { throw new Error(`${subject}: ${error.message}`) }
}
const bytes = gzipSync(Buffer.from(JSON.stringify(corpus)), { level: 9, mtime: 0 })

// The archive is built on every run, so `--check` compares it too: a missing or stale source
// archive is as much a stale checkout as a stale corpus.
const inputs = { 'COPYING': await readFile(new URL('../data/COPYING-chise-ids.txt', import.meta.url)) }
await source(manifest.readme)
inputs[manifest.readme.file] = await readFile(resolve(CACHE, manifest.readme.file))
for (const entry of manifest.files) inputs[entry.file] = await readFile(resolve(CACHE, entry.file))
inputs['README'] = Buffer.from(`${[
  `CHISE-IDS source files for data/ids-corpus.json.gz, from ${manifest.repository}`,
  'maintained by MORIOKA Tomohiko and contributors, GPL-2.0-or-later: see CHISE-README.md for the',
  'grant and COPYING for the text.', '',
  `retrieved ${manifest.retrieved}; the pin is the branch ${manifest.pin}`, '',
  ...[manifest.readme, ...manifest.files].map(entry => `${entry.sha256}  ${entry.file}`),
].join('\n')}\n`)
const archive = gzipSync(tar(inputs), { level: 9, mtime: 0 })
const ARCHIVE = new URL('../data/ids-corpus-sources.tar.gz', import.meta.url)

if (CHECK) {
  for (const [path, expected] of [[OUT, bytes], [ARCHIVE, archive]]) {
    const committed = await readFile(path).catch(() => null)
    if (!committed || !committed.equals(expected)) throw new Error(`${path} is not what this build writes`)
  }
  console.log(`${OUT}: up to date`)
} else {
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, bytes)
  await writeFile(ARCHIVE, archive)
  console.log(`${OUT}: ${corpus.counts.descriptions} descriptions, ${corpus.counts.components} components, ${corpus.counts.unresolved} unresolved, ${bytes.length} bytes`)
}
