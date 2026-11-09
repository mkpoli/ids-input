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

// Equivalences: BabelStone names a part `{n}` where CHISE names it `&name;`. Aligning their
// descriptions of one character, operator by operator, and keeping the operand positions where the
// two differ gives the two names that stand for one component. A pair seen on several characters is
// stronger than one seen once. A component against a *character* is not recorded: a part may look
// like 叀 without being the character 叀, and the alignment cannot tell the two apart.
const TOKEN = /\{(\d+)\}|&([^;]+);|./gsu
/** The IDS fragment note 6 gives each numbered component; a number with one is compared as that
 * fragment, so a composite such as {2} (`⿱⺈𫩏`) is not taken for its first character. */
const fragments = new Map()
for (const line of (await readFile(new URL('../data/ids-components.tsv', import.meta.url), 'utf8')).split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const [name, , fragment] = line.split('\t')
  const number = Number(name?.slice(1, -1))
  if (fragment && Number.isInteger(number)) fragments.set(number, fragment)
}
/** @param {string} value @param {Set<number>} [seen] */
const expand = (value, seen = new Set()) => value.replace(/\{(\d+)\}/g, (whole, digits) => {
  const number = Number(digits), fragment = fragments.get(number)
  if (fragment === undefined || seen.has(number)) return whole
  return expand(fragment, new Set([...seen, number]))
})
const tokenize = value => [...expand(value).matchAll(TOKEN)].map(match => match[0])
/** @type {Map<number, { babel: typeof rows, chise: typeof rows }>} */
const bySubject = new Map()
for (const row of rows) {
  let group = bySubject.get(row.subject)
  if (!group) bySubject.set(row.subject, group = { babel: [], chise: [] })
  ;(row.prov === babelProv ? group.babel : group.chise).push(row)
}
/** @type {Map<string, { a: string, b: string, count: number, prov: Set<number>, chars: string[] }>} */
const aligned = new Map()
const record = (a, b, prov, char) => {
  const [one, two] = [a, b].sort()
  const key = `${one}\0${two}`
  let found = aligned.get(key)
  if (!found) aligned.set(key, found = { a: one, b: two, prov: new Set(), chars: new Set() })
  found.prov.add(prov)
  found.chars.add(char)
}
for (const [subject, group] of bySubject) {
  for (const b of group.babel) {
    const bt = tokenize(b.text)
    for (const c of group.chise) {
      const ct = tokenize(c.text)
      if (bt.length !== ct.length) continue
      /** @type {[number, string, string][]} */
      const diff = []
      let sameOperators = true
      for (let i = 0; i < bt.length; i++) {
        if (bt[i] === ct[i]) continue
        if (OPERATORS.has(bt[i]) || OPERATORS.has(ct[i])) { sameOperators = false; break }
        diff.push([i, bt[i], ct[i]])
      }
      if (!sameOperators || !diff.length) continue
      for (const [, x, y] of diff) {
        for (const [a, d] of [[x, y], [y, x]]) {
          const numbered = /^\{(\d+)\}$/.exec(a), entity = /^&([^;]+);$/.exec(d)
          if (numbered && entity) record(`bsp:${numbered[1]}`, `chise:${entity[1]}`, c.prov, String.fromCodePoint(subject))
        }
      }
    }
  }
}
const equivalences = [...aligned.values()]
  .map(found => {
    // One character's regional descriptions may give the same pair several times; the count is of
    // characters, not descriptions.
    const characters = [...found.chars]
    return [found.a, found.b, 'alignment', characters.length >= 2 ? 'verified' : 'candidate',
      [...found.prov, babelProv].sort((a, b) => a - b),
      `${characters.length} ${characters.length === 1 ? 'character' : 'characters'}: ${characters.join(' ')}`]
  })
  .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))

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

// BabelStone's numbered components, after the CHISE entities so their private-use slots stay put.
const numbered = []
for (const line of (await readFile(new URL('../data/ids-components.tsv', import.meta.url), 'utf8')).split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const [name, description, fragment] = line.split('\t')
  const number = Number(name?.slice(1, -1))
  if (Number.isInteger(number)) numbered.push({ number, description, fragment: fragment || null })
}
numbered.sort((a, b) => a.number - b.number)
for (const { number } of numbered) {
  const cid = `bsp:${number}`
  const char = PUA_BASE + nextSlot++
  components.push([cid, `U+${char.toString(16).toUpperCase()}`, 'unencoded', 'u', null, 0, null, false, null])
  aliases.push([cid, 'bsp', String(number), babelProv, 'number', 'glyph', 'verified'])
  aliases.push([cid, 'char', `U+${char.toString(16).toUpperCase()}`, babelProv, 'codepoint', 'character', 'verified'])
}

// The equivalence table as its own small document, for the appendix page. Labels come from the
// components' characters and note 6's descriptions, so a reader sees `CDP-8BD0` beside `top of 專惠`.
const charOf = new Map(components.map(([cid, code]) => [cid, code ? String.fromCodePoint(Number.parseInt(code.slice(2), 16)) : null]))
const descriptionOf = new Map(numbered.map(({ number, description }) => [`bsp:${number}`, description]))
const fragmentOf = new Map(numbered.map(({ number, fragment }) => [`bsp:${number}`, fragment]))
const equivalenceDoc = {
  format: 'ids-input/equivalences',
  version: 1,
  licence: 'GPL-2.0-or-later',
  sources,
  provenance,
  columns: ['a', 'b', 'aChar', 'bChar', 'aDescription', 'bDescription', 'basis', 'status', 'prov', 'note'],
  rows: equivalences.map(([a, b, basis, status, prov, note]) => [
    a, b, charOf.get(a) ?? null, charOf.get(b) ?? null,
    descriptionOf.get(a) ?? null, descriptionOf.get(b) ?? null, basis, status, prov, note,
  ]),
}
const EQUIVALENCES = new URL('../data/ids-equivalences.json', import.meta.url)
const equivalenceBytes = Buffer.from(`${JSON.stringify(equivalenceDoc, null, 1)}\n`)

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

// Every component the descriptions use, encoded or not: the numbered parts, the CHISE entities and
// the characters that fill the other operands. The appendix lists the lot, with an equivalence where
// one is known.
const uses = new Map()
const use = cid => uses.set(cid, (uses.get(cid) ?? 0) + 1)
for (const row of descriptions) {
  for (const match of row[1].matchAll(/\{(\d+)\}|&([^;]+);|./gsu)) {
    const [whole, number, entity] = match
    if (number) use(`bsp:${number}`)
    else if (entity) use(`chise:${entity}`)
    else if (!OPERATORS.has(whole)) use(`ucs:${(whole.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
  }
}
/** @type {Map<string, { cid: string, status: string, note: string }[]>} */
const equivalentsOf = new Map()
for (const [a, b, , status, , note] of equivalences) {
  for (const [one, two] of [[a, b], [b, a]]) {
    const list = equivalentsOf.get(one) ?? []
    list.push({ cid: two, status, note })
    equivalentsOf.set(one, list)
  }
}
const componentRows = components.map(([cid, code]) => {
  const kind = cid.startsWith('bsp:') ? 'number' : cid.startsWith('chise:') ? 'entity' : 'character'
  const number = /^bsp:(\d+)$/.exec(cid)
  const description = number ? descriptionOf.get(`bsp:${number[1]}`) ?? null : null
  const pua = number ? /\(([0-9A-F]{4,6})\)\s*$/.exec(description ?? '') : null
  return {
    cid,
    char: pua ? String.fromCodePoint(Number.parseInt(pua[1], 16)) : code ? String.fromCodePoint(Number.parseInt(code.slice(2), 16)) : null,
    kind,
    label: number ? `{${number[1]}}` : cid.replace(/^chise:/, ''),
    description: description ? description.replace(/\s*\([0-9A-F]{4,6}\)\s*$/, '') : description,
    fragment: number ? fragmentOf.get(`bsp:${number[1]}`) ?? null : null,
    uses: uses.get(cid) ?? 0,
    equivalents: equivalentsOf.get(cid) ?? [],
  }
})
const encodedRows = [...uses.keys()].filter(cid => cid.startsWith('ucs:') && !charOf.has(cid)).map(cid => {
  const point = Number.parseInt(cid.slice(4), 16)
  return { cid, char: String.fromCodePoint(point), kind: 'character', label: String.fromCodePoint(point), description: null, uses: uses.get(cid) ?? 0, equivalents: equivalentsOf.get(cid) ?? [] }
})
const RANK = { number: 0, entity: 1, character: 2 }
const indexRows = [...componentRows, ...encodedRows].sort((a, b) =>
  (RANK[a.kind] - RANK[b.kind]) || a.cid.localeCompare(b.cid))
const indexDoc = {
  format: 'ids-input/components',
  version: 1,
  licence: 'GPL-2.0-or-later',
  sources,
  provenance,
  counts: { all: indexRows.length, number: indexRows.filter(row => row.kind === 'number').length, entity: indexRows.filter(row => row.kind === 'entity').length, character: indexRows.filter(row => row.kind === 'character').length },
  rows: indexRows,
}
const INDEX = new URL('../data/ids-components-index.json.gz', import.meta.url)
const indexBytes = gzipSync(Buffer.from(JSON.stringify(indexDoc)), { level: 9, mtime: 0 })

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
  equivalences: { columns: ['a', 'b', 'basis', 'status', 'prov', 'note'], rows: equivalences },
  merges: { columns: ['kept', 'absorbed', 'basis', 'prov', 'note'], rows: [] },
  descriptions: { columns: ['subject', 'text', 'resolved', 'prov', 'regions', 'role', 'status'], rows: descriptions },
  counts: {
    descriptions: descriptions.length,
    components: components.length,
    unresolved: descriptions.filter(row => row[6] === 'unresolved').length,
    ready: descriptions.filter(row => row[6] === 'ready').length,
    equivalences: equivalences.length,
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
  for (const [path, expected] of [[OUT, bytes], [ARCHIVE, archive], [EQUIVALENCES, equivalenceBytes], [INDEX, indexBytes]]) {
    const committed = await readFile(path).catch(() => null)
    if (!committed || !committed.equals(expected)) throw new Error(`${path} is not what this build writes`)
  }
  console.log(`${OUT}: up to date`)
} else {
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, bytes)
  await writeFile(ARCHIVE, archive)
  await writeFile(EQUIVALENCES, equivalenceBytes)
  await writeFile(INDEX, indexBytes)
  console.log(`${OUT}: ${corpus.counts.descriptions} descriptions, ${corpus.counts.components} components, ${corpus.counts.unresolved} unresolved, ${bytes.length} bytes`)
  console.log(`${EQUIVALENCES}: ${equivalences.length} equivalences, ${equivalenceBytes.length} bytes`)
  console.log(`${INDEX}: ${indexRows.length} components, ${indexBytes.length} bytes`)
}
