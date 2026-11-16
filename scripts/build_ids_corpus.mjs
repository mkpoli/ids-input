// Build data/ids-corpus.json.gz: one catalogue of component identities and the descriptions that
// name them, from BabelStone IDS and CHISE. Design: docs/ids-corpus.md.
//
//   bun scripts/build_ids_corpus.mjs [--out FILE] [--cache DIR] [--check]
//
// It reads BabelStone, the CHISE UCS files, Yi Bai's zi.tools rows and this project's own tables
// (`ids-project.tsv`, the descriptions of `custom-ids.tsv`, `tangut-layers.json.gz`). A CHISE entity name
// (`&GT-K01666;`) has no ontology resolution yet, so its component is a cid with a private-use form
// and its descriptions stay `unresolved`: the catalogue records the part without pretending to know
// how it is drawn.
//
// Alongside the corpus the build writes data/ids-corpus-sources.tar.gz: the CHISE inputs it read,
// their digests and the licence, so the GPL source offer does not depend on the pinned URLs.
import { createHash } from 'node:crypto'
import { gzipSync, inflateRawSync } from 'node:zlib'
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

/** Rows collected as (subject, text) with the provenance of the source that says it. `core` marks the
 * BabelStone and CHISE rows: the components, the alignment and the use counts are read off those
 * alone, so a source added beside them leaves them as they were. */
const rows = []
const regions = row => row.regions ?? ''
for (const line of gunzipSync(await readFile(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString('utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, rest] = line.split('\t')
  if (!rest || [...char].length !== 1) continue
  for (const sequence of rest.split(' ')) {
    const match = sequence.match(/^([^()]+)\((.*)\)$/)
    if (!match) continue
    rows.push({ subject: char.codePointAt(0), text: match[1], regions: match[2], prov: babelProv, role: 'source', core: true })
  }
}

for (const [i, entry] of manifest.files.entries()) {
  const content = await source(entry)
  for (const line of content.split('\n')) {
    if (!line || line.startsWith(';;')) continue
    const fields = line.split('\t')
    // CHISE writes a character as `U+4E00` in some files and `U-0002A700` in others; both name it.
    if (fields.length < 3 || !/^U[+-][0-9A-F]+$/i.test(fields[0]) || [...fields[1]].length !== 1) continue
    rows.push({ subject: fields[1].codePointAt(0), text: fields[2], regions: '', prov: chiseProv[i], role: 'source', core: true })
  }
}

// Yi Bai's zi.tools rows, one provenance per level. `zi-tools-rows.tsv.gz` writes level 0 for every
// line of ids_lv0.txt and levels 1 and 2 only where they differ from the level before, so a level
// that writes a line as the one before it attests the same descriptions. A description stays as
// zi.tools writes it, entry notes and stroke chains included.
const ziBytes = await readFile(new URL('../data/zi-tools-rows.tsv.gz', import.meta.url))
const ziLines = gunzipSync(ziBytes).toString('utf8').split('\n')
const ziHeader = /^# yi-bai\/ids ([0-9a-f]{40}); MIT, Copyright \(c\) 2021 Yi Bai; ids_lv0\.txt ([0-9a-f]{64}), ids_lv1\.txt ([0-9a-f]{64}), ids_lv2\.txt ([0-9a-f]{64})\.$/.exec(ziLines[0])
if (!ziHeader) throw new Error('data/zi-tools-rows.tsv.gz: unexpected header')
const ziProv = [0, 1, 2].map(level => sourceIndex({
  title: `Yi Bai IDS level ${level} (zi.tools)`,
  url: `https://github.com/yi-bai/ids/blob/${ziHeader[1]}/ids_lv${level}.txt`,
  date: '2026-10-31', edition: ziHeader[1], licence: 'MIT', sha256: ziHeader[2 + level],
}, `yibai-lv${level}`))
const emitZi = levels => {
  if (!levels[0]) return
  const char = levels[0].split('\t')[0]
  if ([...char].length !== 1) return
  for (let level = 0; level < 3; level++) {
    levels[level] ??= levels[level - 1]
    for (const column of levels[level].split('\t').slice(1)) for (const part of column.split(';')) {
      const written = part.trim()
      if (written) rows.push({ subject: char.codePointAt(0), text: written, regions: '', prov: ziProv[level], role: 'source', core: false })
    }
  }
}
/** @type {(string | undefined)[]} */
let levels = []
for (const line of ziLines.slice(1)) {
  if (!line) continue
  const level = Number(line[0])
  if (level === 0) { emitZi(levels); levels = [] }
  levels[level] = line.slice(2)
}
emitZi(levels)

// This project's own rows. The curated descriptions of `ids-project.tsv` are editorial: a reading
// the project chose over a source's spelling. `custom-ids.tsv` is the ledger of forms no code point
// names; a name in it that is an IDS describes the form, whose subject is its ledger cid
// (`x:X-00001`, a number of its own ledger, not a private-use slot of this corpus). A retired number
// describes nothing. `tangut-layers.json.gz` is computed from BabelStone's Tangut descriptions, so
// its rows are derived.
const own = async (name, title) => {
  const bytes = await readFile(new URL(`../data/${name}`, import.meta.url))
  const id = name.replace(/\..*$/, '')
  return { bytes, prov: sourceIndex({ title, url: `https://github.com/mkpoli/ids-input/blob/main/data/${name}`,
    date: '', edition: '', licence: 'MIT', sha256: digest(bytes) }, id) }
}
const lines = bytes => text(bytes).split(/\r?\n/).filter(line => line && !line.startsWith('#'))
const OPERATOR_FIRST = /^[⿰-⿿㇯〾]/u
const project = await own('ids-project.tsv', 'ids-input curated descriptions')
for (const line of lines(project.bytes)) {
  const [char, written] = line.split('\t')
  if (!written || [...char].length !== 1) continue
  rows.push({ subject: char.codePointAt(0), text: written, regions: '', prov: project.prov, role: 'editorial', core: false })
}
const ledger = await own('custom-ids.tsv', 'ids-input form ledger')
const retired = new Set(lines(ledger.bytes).map(line => line.split('\t')).filter(([, , , note]) => note?.startsWith('merged into') || note === 'withdrawn').map(([id]) => id))
for (const line of lines(ledger.bytes)) {
  const [id, alias] = line.split('\t')
  if (retired.has(id) || !alias || !OPERATOR_FIRST.test(alias)) continue
  rows.push({ subject: `x:${id}`, text: alias, regions: '', prov: ledger.prov, role: 'source', core: false })
}
const layers = await own('tangut-layers.json.gz', 'ids-input Tangut layers')
for (const [char, written] of Object.entries(JSON.parse(gunzipSync(layers.bytes).toString('utf8')).characters)) {
  rows.push({ subject: char.codePointAt(0), text: written, regions: '', prov: layers.prov, role: 'derived', core: false })
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
  if (!row.core) continue
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
const alignments = [...aligned.values()]
  .map(found => {
    // One character's regional descriptions may give the same pair several times; the count is of
    // characters, not descriptions.
    const characters = [...found.chars]
    return [found.a, found.b, 'alignment', characters.length >= 2 ? 'verified' : 'candidate',
      [...found.prov, babelProv].sort((a, b) => a - b),
      `${characters.length} ${characters.length === 1 ? 'character' : 'characters'}: ${characters.join(' ')}`]
  })
  .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))

// Class membership. A class row says that `a`, the member, is the component `b`, the target, drawn
// another way: ⺭ is 礻, and 礻 at the left is 示. Each row names its basis, the place it holds at
// (empty: anywhere) and a tier: `source` where a table states it, `derived` where the build infers
// it. A member resolves by following its rows to a component that is no member of anything, the
// class's canonical member; the build reports a member that resolves to two canonicals at one
// place, and a pair given at one place by one table and everywhere by another. A pair with no row
// is never merged.
const PLACES = new Set(['left', 'right', 'top', 'bottom', 'middle', 'partial'])
// IRG entry 23 reads 䒑 as 丷 over 一 at the top of 前, 羊 and 益, so its row for 艸 is not read.
const UNREAD = new Set(['䒑'])
const ucsOf = char => `ucs:${char.codePointAt(0).toString(16).toUpperCase()}`
const bareChar = value => [...value].filter(char => !/[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/u.test(char)).join('')
/** @type {{ member: string, target: string, basis: string, place: string, tier: string, prov: number, note: string }[]} */
const classRows = []
const addClass = (member, target, basis, place, tier, prov, note) => {
  if (member !== target) classRows.push({ member, target, basis, place, tier, prov, note })
}

const formsBytes = await readFile(new URL('../data/component-forms.tsv', import.meta.url))
const ucdProv = sourceIndex({ title: 'Unicode EquivalentUnifiedIdeograph.txt 18.0.0, as copied into component-forms.tsv',
  url: 'https://www.unicode.org/Public/18.0.0/ucd/EquivalentUnifiedIdeograph.txt', date: '', edition: '18.0.0',
  licence: 'Unicode-3.0', sha256: digest(formsBytes) }, 'unicode-equivalent-ideographs')
const cjkviProv = sourceIndex({ title: 'cjkvi-variants radical-variants.txt, as copied into component-forms.tsv',
  url: 'https://github.com/cjkvi/cjkvi-variants/blob/e4f1da248c9737a243f9930b5dc497cef5d5ae16/radical-variants.txt',
  date: '', edition: 'e4f1da248c9737a243f9930b5dc497cef5d5ae16', licence: 'Public Domain', sha256: digest(formsBytes) }, 'cjkvi-radical-variants')
/** The character a Kangxi radical form is, by the form: ⽰ is 示. */
const equivalentOf = new Map()
/** What the radical variants say of each form, whether they fold it or not: 忄 names no place and stays 忄. */
const variantOf = new Map()
/** The pairs component-forms.tsv states, either way round, as variants of one another. */
const variantPairs = new Set()
const edge = (a, b) => { variantPairs.add(`${a}\0${b}`); variantPairs.add(`${b}\0${a}`) }
for (const line of lines(formsBytes)) {
  const [form, char, origin, detail = ''] = line.split('\t')
  if (form === 'form' || [...form].length !== 1 || [...char].length !== 1) continue
  edge(form, char)
  if (origin === 'unicode-ucd') {
    equivalentOf.set(form, char)
    addClass(ucsOf(form), ucsOf(char), 'radical-form', '', 'source', ucdProv, detail)
  } else if (origin === 'cjkvi-variants') {
    const place = PLACES.has(detail.split(' ').at(-1) ?? '') ? detail.split(' ').at(-1) : ''
    variantOf.set(form, { target: char, place })
    if (place && !UNREAD.has(form)) addClass(ucsOf(form), ucsOf(char), 'positional-form', place, 'source', cjkviProv, detail)
  }
}

/** The Unihan.zip member `name`, read with the central directory. @param {Buffer} zip @param {string} name */
function unzip(zip, name) {
  let end = zip.length - 22
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Unihan.zip: no end of central directory')
  let at = zip.readUInt32LE(end + 16)
  for (let entries = zip.readUInt16LE(end + 10); entries > 0; entries--) {
    const length = zip.readUInt16LE(at + 28), extra = zip.readUInt16LE(at + 30), comment = zip.readUInt16LE(at + 32)
    if (zip.toString('utf8', at + 46, at + 46 + length) === name) {
      const method = zip.readUInt16LE(at + 10), size = zip.readUInt32LE(at + 20), local = zip.readUInt32LE(at + 42)
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const data = zip.subarray(start, start + size)
      return method === 8 ? inflateRawSync(data).toString('utf8') : data.toString('utf8')
    }
    at += 46 + length + extra + comment
  }
  throw new Error(`Unihan.zip: no ${name}`)
}
const UNIHAN = { file: 'Unihan.zip', url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
  sha256: '4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e' }
await mkdir(resolve(CACHE, '../unihan'), { recursive: true })
const unihanPath = resolve(CACHE, '../unihan', UNIHAN.file)
let unihanBytes = await readFile(unihanPath).catch(() => null)
if (!unihanBytes || digest(unihanBytes) !== UNIHAN.sha256) {
  const response = await fetch(UNIHAN.url)
  if (!response.ok) throw new Error(`${UNIHAN.file}: ${response.status}`)
  unihanBytes = Buffer.from(await response.arrayBuffer())
  if (digest(unihanBytes) !== UNIHAN.sha256) throw new Error(`${UNIHAN.file}: pinned ${UNIHAN.sha256}, fetched ${digest(unihanBytes)}`)
  await writeFile(unihanPath, unihanBytes)
}
const unihanProv = sourceIndex({ title: 'Unihan 18.0.0', url: UNIHAN.url, date: '', edition: '18.0.0',
  licence: 'Unicode-3.0', sha256: UNIHAN.sha256 }, 'unihan')
for (const line of unzip(unihanBytes, 'Unihan_Variants.txt').split('\n')) {
  const [code, field, value] = line.split('\t')
  if (!/^U\+[0-9A-F]+$/.test(code ?? '') || !/^k(?:Z|Semantic|SpecializedSemantic|Simplified|Traditional|JapaneseNew|JapaneseOld)Variant$/.test(field ?? '')) continue
  const char = String.fromCodePoint(Number.parseInt(code.slice(2), 16))
  for (const one of value.split(' ')) {
    const match = /^U\+([0-9A-F]+)/.exec(one)
    if (match) edge(char, String.fromCodePoint(Number.parseInt(match[1], 16)))
  }
}
// A character whose radical is the whole of it (`113.0`, with no residual strokes) can be the
// radical drawn another way. Unihan files characters of their own the same way (曱 `102.0` is a
// cockroach, not 田), so a row is written only for a member that is a form of the radical: it has
// the radical's stroke count and no definition of its own. A primed number is the simplified
// radical's form (`149'.0` is 讠 for 言). A form the radical variants list, or a compatibility
// ideograph of one, is read as they say, at the place they name or not at all: Unihan files 忄 and 䒑
// under their radicals, and reading that anywhere would fold what they leave apart. Such a row is
// not written and goes in the conflict report.
const strokes = new Map(), defined = new Set(), radicalValues = []
for (const line of unzip(unihanBytes, 'Unihan_IRGSources.txt').split('\n')) {
  const [code, field, value] = line.split('\t')
  if (!/^U\+[0-9A-F]+$/.test(code ?? '')) continue
  const char = String.fromCodePoint(Number.parseInt(code.slice(2), 16))
  if (field === 'kTotalStrokes') strokes.set(char, Number(value.split(' ')[0]))
  else if (field === 'kRSUnicode') radicalValues.push([char, value.split(' ')])
}
for (const line of unzip(unihanBytes, 'Unihan_Readings.txt').split('\n')) {
  const [code, field] = line.split('\t')
  if (field === 'kDefinition' && /^U\+[0-9A-F]+$/.test(code)) defined.add(String.fromCodePoint(Number.parseInt(code.slice(2), 16)))
}
const overridden = []
for (const [member, values] of radicalValues) for (const one of values) {
  const match = /^(\d+)'*\.0$/.exec(one)
  const target = match ? equivalentOf.get(String.fromCodePoint(0x2F00 + Number(match[1]) - 1)) : undefined
  if (!target) continue
  const listed = variantOf.get(member.normalize('NFC'))
  if (listed) overridden.push({ member: ucsOf(member), target: ucsOf(target), listed, note: `kRSUnicode ${one}` })
  else if (member.normalize('NFC') !== target && !defined.has(member) && strokes.has(member) && strokes.get(member) === strokes.get(target)) {
    addClass(ucsOf(member), ucsOf(target), 'radical-index', '', 'derived', unihanProv, `kRSUnicode ${one}`)
  }
}

// The IRG's unifiable list at level 1, read as the first form each entry names. The list unifies
// shapes where they vary, and two of its shapes can be different characters elsewhere (主 and 龶), so
// two characters of an entry are one component only where a variant table, Unihan's or the radical
// variants above, also gives them as variants. Entries that share a shape are one class, read as the
// first shape of the entry that first joined two of them. Level 2 pairs shapes that are different
// characters elsewhere (土 and 士) and is not read, and neither is a shape written as a description.
const ucv = JSON.parse(await readFile(new URL('../data/ucv.json', import.meta.url), 'utf8'))
const ucvProv = sourceIndex({ title: ucv.source.document, url: ucv.source.documentUrl, date: '2026-10-20',
  edition: `${ucv.source.name}, ${ucv.source.revision}`, licence: 'Public Domain', sha256: ucv.source.sha256 }, 'irg-ucv')
const heads = new Map(), formed = new Map(), joined = new Map()
const headOf = shape => { while (heads.get(shape) !== shape) shape = heads.get(shape); return shape }
for (const [number, entry] of ucv.entries.entries()) {
  if (entry.kind !== 'unifiable' || entry.level !== 1) continue
  const shapes = [...new Set(entry.forms.map(form => bareChar(form.text ?? form.of ?? '')).filter(shape => [...shape].length === 1))]
  for (const shape of shapes) if (!heads.has(shape)) heads.set(shape, shape)
  for (const [index, shape] of shapes.entries()) for (const earlier of shapes.slice(0, index)) {
    if (!variantPairs.has(`${shape}\0${earlier}`)) continue
    let first = headOf(earlier), second = headOf(shape)
    if (first === second) continue
    if ((formed.get(second) ?? number) < (formed.get(first) ?? number)) [first, second] = [second, first]
    heads.set(second, first)
    joined.set(second, entry.id)
    if (!formed.has(first)) formed.set(first, number)
  }
}
// A positional form, or the character it is the form of, is no placeless member: 礻 is 示 at the left
// only, and 攵 is 攴 at the right, not 攴 anywhere.
const positional = (member, target) => variantOf.get(member.normalize('NFC'))?.place && variantOf.get(member.normalize('NFC')).target === target
for (const shape of heads.keys()) {
  const target = headOf(shape)
  if (target !== shape && !positional(shape, target) && !positional(target, shape)) addClass(ucsOf(shape), ucsOf(target), 'unifiable-variant', '', 'source', ucvProv, `entry ${joined.get(shape) ?? ''}, level 1`)
}

// A pair attested under two bases, at the same place, is verified, under one a candidate.
const basesOf = new Map()
for (const row of classRows) {
  const key = `${row.member}\0${row.target}\0${row.place}`
  basesOf.set(key, (basesOf.get(key) ?? new Set()).add(row.basis))
}
const classMembers = classRows
  .map(row => ['class-member', row])
  .map(([kind, row]) => [row.member, row.target, kind, row.basis, row.place, row.tier,
    basesOf.get(`${row.member}\0${row.target}\0${row.place}`).size >= 2 ? 'verified' : 'candidate', [row.prov], row.note])
  .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[3].localeCompare(b[3]) || a[4].localeCompare(b[4]))

// The conflict report: members that resolve to two canonicals at one place, rows that make a cycle,
// and the Unihan radical rows the radical variants overrule.
const outgoing = new Map()
for (const row of classMembers) outgoing.set(row[0], [...(outgoing.get(row[0]) ?? []), row])
const cidChar = cid => String.fromCodePoint(Number.parseInt(cid.slice(4), 16))
const conflicts = []
/** @type {Map<string, Set<string>>} */
const cycles = new Map()
const canonicalsOf = (char, place, path) => {
  if (path.includes(char)) {
    // One cycle, written from its smallest member, whichever member reached it.
    const members = path.slice(path.indexOf(char))
    const from = members.indexOf([...members].sort()[0])
    const loop = [...members.slice(from), ...members.slice(0, from), members[from]].map(cidChar).join(' > ')
    cycles.set(loop, (cycles.get(loop) ?? new Set()).add(place || 'anywhere'))
    return new Set()
  }
  const next = (outgoing.get(char) ?? []).filter(row => row[4] === '' || row[4] === place)
  if (!next.length) return new Set([char])
  return new Set(next.flatMap(row => [...canonicalsOf(row[1], place, [...path, char])]))
}
for (const [member, rows] of [...outgoing].sort(([a], [b]) => a.localeCompare(b))) {
  /** @type {Map<string, string[]>} */
  const byTargets = new Map()
  for (const place of ['', ...PLACES]) {
    const terminals = [...canonicalsOf(member, place, [])].sort()
    if (terminals.length > 1) byTargets.set(terminals.map(cidChar).join(' '), [...(byTargets.get(terminals.map(cidChar).join(' ')) ?? []), place || 'anywhere'])
  }
  for (const [targets, places] of byTargets) {
    conflicts.push(['two-canonicals', member, places.join(' '), targets, [...new Set(rows.map(row => row[3]))].join(' '), ''])
  }
}
for (const [member, rows] of outgoing) {
  /** @type {Map<string, typeof rows>} */
  const pairs = new Map()
  for (const row of rows) pairs.set(row[1], [...(pairs.get(row[1]) ?? []), row])
  for (const [target, pair] of pairs) {
    if (pair.some(row => row[4] === '') && pair.some(row => row[4] !== '')) {
      conflicts.push(['place', member, pair.filter(row => row[4]).map(row => row[4]).join(' '), cidChar(target),
        pair.map(row => `${row[3]}${row[4] ? `@${row[4]}` : ''}`).join(' '), 'a table gives this pair at a place, another anywhere'])
    }
  }
}
for (const [loop, places] of cycles) conflicts.push(['cycle', loop.split(' > ')[0], [...places].join(' '), loop, '', 'rows lead a member back to itself'])
for (const { member, target, listed, note } of overridden) {
  conflicts.push(['radical-index', member, listed.place, cidChar(target), 'unihan',
    `${note}: the radical variants give ${listed.target} ${listed.place ? `at ${listed.place}` : 'at no place'}${UNREAD.has(cidChar(member)) ? ', a row not read' : ''}`])
}
const conflictText = ['# Class rows that disagree, from scripts/build_ids_corpus.mjs. kind, member, place, targets, bases, note.',
  ...conflicts.map(([kind, member, place, targets, bases, note]) => [kind, cidChar(member), place, targets, bases, note].join('\t'))
    .sort()].join('\n') + '\n'
const CONFLICTS = new URL('../data/ids-class-conflicts.tsv', import.meta.url)
const equivalences = [
  ...alignments.map(([a, b, basis, status, prov, note]) => [a, b, 'alignment', basis, '', 'derived', status, prov, note]),
  ...classMembers,
]

// Component identities: every entity name CHISE uses that no codepoint covers.
const components = []
const aliases = []
const byName = new Map()
let nextSlot = 0
const entityNames = new Set()
for (const row of rows) if (row.core) for (const [, name] of row.text.matchAll(ENTITY)) entityNames.add(name)
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

// An entity name in this project's rows must be one CHISE or BabelStone already name: a new slot
// would move the private-use forms every later release is read against.
for (const row of rows) if (!row.core) for (const [, name] of row.text.matchAll(ENTITY)) if (!byName.has(name)) throw new Error(`${row.subject}: &${name}; names no known component`)

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
  rows: alignments.map(([a, b, basis, status, prov, note]) => [
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
  // A row the composer's parser reports a problem with is kept as written and not drawn.
  if (parse(value).problem) return 'unsupported'
  return 'ready'
}

const seen = new Map()
for (const row of rows) {
  const key = `${row.subject}\0${row.text}\0${regions(row)}\0${row.role}`
  const found = seen.get(key)
  if (found) { if (!found.prov.includes(row.prov)) found.prov.push(row.prov); continue }
  const resolved = resolvedOf(row.text)
  seen.set(key, {
    subject: typeof row.subject === 'string' ? row.subject : `ucs:${row.subject.toString(16).toUpperCase()}`, text: row.text, resolved,
    prov: [row.prov], regions: regions(row), role: row.role, status: statusOf(row.text, resolved),
  })
}
// A character's descriptions lead with the Japanese-tagged reading: the face draws the Japanese
// positional forms, and an untagged row would otherwise put the base character first.
const regionRank = row => row.regions.includes('J') ? 0 : row.regions ? 1 : 2
const descriptions = [...seen.values()]
  .sort((a, b) => a.subject.localeCompare(b.subject) || regionRank(a) - regionRank(b) || a.text.localeCompare(b.text))
  .map(row => [row.subject, row.text, row.resolved, row.prov, row.regions, row.role, row.status])

// Every component the descriptions use, encoded or not: the numbered parts, the CHISE entities and
// the characters that fill the other operands. The appendix lists the lot, with an equivalence where
// one is known.
const uses = new Map()
const use = cid => uses.set(cid, (uses.get(cid) ?? 0) + 1)
const coreProv = new Set([babelProv, ...chiseProv])
for (const row of descriptions) {
  if (!row[3].some(index => coreProv.has(index))) continue
  const text = row[1].replace(/\[[^\]]*\]/g, '')
  for (const match of text.matchAll(/\{(\d+)\}|&([^;]+);|./gsu)) {
    const [whole, number, entity] = match
    if (number) use(`bsp:${number}`)
    else if (entity) use(`chise:${entity}`)
    else if (!OPERATORS.has(whole)) use(`ucs:${(whole.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
  }
}
/** @type {Map<string, { cid: string, status: string, note: string }[]>} */
const equivalentsOf = new Map()
for (const [a, b, , status, , note] of alignments) {
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
      + ' (MORIOKA Tomohiko and contributors), the BabelStone ones are public domain,'
      + ' the Yi Bai ones MIT (Copyright (c) 2021 Yi Bai). The CHISE rows'
      + ` were converted to cids and merged with BabelStone on ${manifest.retrieved}.`
      + ' data/COPYING-chise-ids.txt is the text; data/ids-corpus-sources.tar.gz holds the sources.' },
  pua: { base: PUA_BASE, next: nextSlot },
  sources,
  provenance,
  components: { columns: ['cid', 'char', 'type', 'class', 'label', 'uses', 'strokes', 'strokesDerived', 'first'], rows: components },
  aliases: { columns: ['cid', 'ns', 'value', 'prov', 'basis', 'scope', 'status'], rows: aliases },
  equivalences: { columns: ['a', 'b', 'kind', 'basis', 'place', 'tier', 'status', 'prov', 'note'], rows: equivalences },
  merges: { columns: ['kept', 'absorbed', 'basis', 'prov', 'note'], rows: [] },
  descriptions: { columns: ['subject', 'text', 'resolved', 'prov', 'regions', 'role', 'status'], rows: descriptions },
  counts: {
    descriptions: descriptions.length,
    components: components.length,
    unresolved: descriptions.filter(row => row[6] === 'unresolved').length,
    ready: descriptions.filter(row => row[6] === 'ready').length,
    equivalences: equivalences.length,
    alignments: alignments.length,
    classMembers: classMembers.length,
  },
}

// Every ready row must parse with the parser the composer uses; an unresolved row is not parsed,
// since its entity token stands for a part the catalogue has no form for yet. `parse` reports a
// problem instead of throwing, so the report is what fails the build.
for (const [subject, value, , , , , status] of descriptions) {
  if (status !== 'ready') continue
  const { problem } = parse(value)
  if (problem) throw new Error(`${subject}: ${value}: ${problem}`)
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
  for (const [path, expected] of [[OUT, bytes], [ARCHIVE, archive], [EQUIVALENCES, equivalenceBytes], [INDEX, indexBytes], [CONFLICTS, Buffer.from(conflictText)]]) {
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
  await writeFile(CONFLICTS, conflictText)
  console.log(`${OUT}: ${corpus.counts.descriptions} descriptions, ${corpus.counts.components} components, ${corpus.counts.unresolved} unresolved, ${bytes.length} bytes`)
  console.log(`${EQUIVALENCES}: ${alignments.length} alignments, ${equivalenceBytes.length} bytes`)
  console.log(`${INDEX}: ${indexRows.length} components, ${indexBytes.length} bytes`)
}
