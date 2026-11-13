// Build `data/open-strokes/`: the stroke order of Han characters by writing style, each row from a
// named source or induced from one and marked so.
//
//   rime-stroke.tsv.gz  mainland order, as Rime's five-stroke dictionary records it (LGPL-3.0)
//   cns11643.tsv.gz     Taiwan order, as CNS 全字庫 records it (Open Government Data License 1.0)
//   induced.tsv.gz      characters a style's source lacks, written from a character the source has:
//                       the unified ideograph a compatibility form or radical is equivalent to, or
//                       the components of its ideographic description sequence
//
// An induced order joins the orders of a description's components by one rule per operator. The
// rules are scored first on the characters the source does record, operator by operator, and only
// the operators listed in RELIABLE are induced through; the manifest carries the scores.
//
//   bun scripts/build_open_strokes.mjs [stroke.dict.yaml] [Properties.zip] [MapingTables.zip]
//
// Local copies skip the downloads. The CNS archives are not versioned upstream, so the manifest
// records the SHA-256 of the copies read.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { characterScript } from '../src/core/scripts.js'

const OUT = new URL('../data/open-strokes/', import.meta.url)
const RIME = {
  revision: '1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48',
  url: 'https://raw.githubusercontent.com/rime/rime-stroke/1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48/stroke.dict.yaml',
  sha256: 'b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791',
}
const CNS = {
  properties: 'https://www.cns11643.gov.tw/opendata/Properties.zip',
  mapping: 'https://www.cns11643.gov.tw/opendata/MapingTables.zip',
}
/** The operators an order is induced through, with the rule each is read by. */
const RELIABLE = ['⿰', '⿱', '⿲', '⿳', '⿴', '⿵', '⿶', '⿷', '⿸', '⿺']
const ARITY = { '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2, '⿼': 2, '⿽': 2, '⿾': 1, '⿿': 1, '㇯': 2 }
/** The walking enclosures, written after what they carry. */
const WALKING = new Set([...'辶廴辵⻌⻍⻎'])
/** How many ways of writing one character an induced row keeps. */
const WAYS = 8

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
/** @param {string | undefined} path @param {string} url */
async function source(path, url) {
  const bytes = path ? readFileSync(path) : Buffer.from(await (await fetch(url)).arrayBuffer())
  return { bytes, sha256: sha256(bytes) }
}
const point = char => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
const byCodePoint = (a, b) => a.codePointAt(0) - b.codePointAt(0)

// --- The recorded orders -------------------------------------------------------------------------

const rimeFile = await source(process.argv[2], RIME.url)
if (rimeFile.sha256 !== RIME.sha256) throw Error(`Unexpected rime-stroke: ${RIME.url}`)
/** @type {Map<string, string[]>} */
const rime = new Map()
for (const line of rimeFile.bytes.toString().split('\n')) {
  const [char, code] = line.split('\t')
  if (!char || !code || [...char].length !== 1 || !/^[hspnz]+$/.test(code)) continue
  const known = rime.get(char)
  if (!known) rime.set(char, [code])
  else if (!known.includes(code)) known.push(code)
}

const properties = await source(process.argv[3], CNS.properties), mapping = await source(process.argv[4], CNS.mapping)
const scratch = join(tmpdir(), `open-strokes-${process.pid}`)
mkdirSync(scratch, { recursive: true })
/** One member of a zip, as rows of tab-separated fields. @param {Buffer} bytes @param {string} name @param {string} member */
function member(bytes, name, member) {
  const file = join(scratch, name)
  writeFileSync(file, bytes)
  return execFileSync('unzip', ['-p', file, member], { maxBuffer: 1 << 30 }).toString('utf8').split(/\r?\n/).filter(Boolean).map(line => line.split('\t'))
}
/** @type {Map<string, string[]>} CNS plane-code to the Han characters Unicode maps it to, Private Use left out. */
const unicodeOf = new Map()
for (const plane of ['BMP', '2', '3', '15']) {
  for (const [code, hex] of member(mapping.bytes, 'mapping.zip', `Unicode/CNS2UNICODE_Unicode ${plane}.txt`)) {
    const char = String.fromCodePoint(parseInt(hex, 16))
    if (characterScript(char) !== 'han' || /\p{Co}/u.test(char)) continue
    const list = unicodeOf.get(code)
    if (!list) unicodeOf.set(code, [char])
    else if (!list.includes(char)) list.push(char)
  }
}
/** @type {Map<string, string[]>} */
const cns = new Map()
/** @type {Map<string, string[]>} */
const cnsCodes = new Map()
for (const [code, order] of member(properties.bytes, 'properties.zip', 'CNS_strokes_sequence.txt')) {
  if (!/^[1-5]+$/.test(order ?? '')) continue
  for (const char of unicodeOf.get(code) ?? []) {
    const known = cns.get(char)
    if (!known) cns.set(char, [order])
    else if (!known.includes(order)) known.push(order)
    const codes = cnsCodes.get(char)
    if (!codes) cnsCodes.set(char, [code])
    else if (!codes.includes(code)) codes.push(code)
  }
}

// --- Induction -----------------------------------------------------------------------------------

/** @type {Map<string, { seq: string, regions: string }[]>} */
const ids = new Map()
const idsText = gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString()
for (const line of idsText.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, sequences] = line.split('\t')
  if (!sequences || [...char].length !== 1) continue
  ids.set(char, sequences.split(' ').map(text => {
    const found = /^(.*?)(?:\(([A-Z]+)\))?$/.exec(text)
    return { seq: (found?.[1] ?? text).replace(/^〾/, ''), regions: found?.[2] ?? '' }
  }))
}
/** @typedef {{ leaf: string } | { op: string, parts: Tree[] }} Tree */
/** @param {string} sequence @returns {Tree | null} */
function parse(sequence) {
  const chars = [...sequence]
  let at = 0
  /** @returns {Tree} */
  const node = () => {
    const char = chars[at++]
    if (char === undefined || char === '{' || char === '？') throw Error('unreadable')
    if (!ARITY[char]) return { leaf: char }
    return { op: char, parts: Array.from({ length: ARITY[char] }, node) }
  }
  try { const tree = node(); return at === chars.length ? tree : null } catch { return null }
}
/** Every way of joining one order from each list, in the lists' order. @param {string[][]} lists */
function joined(lists) {
  let out = ['']
  for (const list of lists) out = out.flatMap(start => list.map(end => start + end)).slice(0, 64)
  return out
}
/**
 * The orders a description is written in, from its components' orders: null when a component has
 * none, or when `through` is given and an operator is outside it.
 * @param {Tree} tree @param {Map<string, string[]>} table @param {Set<string>} [through]
 * @returns {string[] | null}
 */
function ordersOf(tree, table, through) {
  if ('leaf' in tree) return table.get(tree.leaf) ?? null
  if (through && !through.has(tree.op)) return null
  const parts = tree.parts.map(part => ordersOf(part, table, through))
  if (parts.some(part => !part)) return null
  const [outer, inner] = /** @type {string[][]} */ (parts)
  // A walking enclosure and an open-topped one are written after what they hold.
  if (tree.op === '⿺' && 'leaf' in tree.parts[0] && WALKING.has(tree.parts[0].leaf)) return joined([inner, outer])
  if (tree.op === '⿶') return joined([inner, outer])
  // A full enclosure is closed by its last stroke; a left-open one begins with its top stroke.
  if (tree.op === '⿴') return [...new Set(outer.flatMap(frame => inner.map(held => frame.slice(0, -1) + held + frame.slice(-1))))].slice(0, 64)
  if (tree.op === '⿷') return [...new Set(outer.flatMap(frame => inner.map(held => frame[0] + held + frame.slice(1))))].slice(0, 64)
  return joined(/** @type {string[][]} */ (parts))
}
/** The description a style reads a character by: the one its region gives, else the first. @param {string} char @param {string} region */
const described = (char, region) => { const list = ids.get(char); return list ? (list.find(entry => entry.regions.includes(region)) ?? list[0]).seq : null }

const STYLES = [
  { style: 'mainland', source: 'rime-stroke', table: rime, region: 'G' },
  { style: 'taiwan', source: 'cns11643', table: cns, region: 'T' },
]
// How often the rules write a recorded character the way its source does, by the description's
// outer operator.
const validation = STYLES.map(({ style, source, table, region }) => {
  /** @type {Map<string, { described: number, written: number, agree: number }>} */
  const byOperator = new Map()
  for (const [char, recorded] of table) {
    const sequence = described(char, region), tree = sequence ? parse(sequence) : null
    if (!tree || 'leaf' in tree) continue
    const tally = byOperator.get(tree.op) ?? byOperator.set(tree.op, { described: 0, written: 0, agree: 0 }).get(tree.op)
    tally.described++
    const written = ordersOf(tree, table)
    if (!written) continue
    tally.written++
    if (written.some(order => recorded.includes(order))) tally.agree++
  }
  return { style, source, operators: [...byOperator].sort((a, b) => b[1].described - a[1].described).map(([operator, tally]) => ({ operator, ...tally, induced: RELIABLE.includes(operator) })) }
})

const repertoire = JSON.parse(gunzipSync(readFileSync(new URL('../data/han-parts.json.gz', import.meta.url)))).keys
// BabelStone IDS also describes Tangut; only Han characters are counted and induced.
const candidates = [...new Set([...repertoire, ...ids.keys()])].filter(char => characterScript(char) === 'han').sort(byCodePoint)
const through = new Set(RELIABLE)
/** @type {string[][]} */
const induced = []
const left = STYLES.map(({ style, source, table, region }) => {
  let equivalent = 0, fromIds = 0, none = 0
  for (const char of candidates) {
    if (table.has(char)) continue
    // A compatibility ideograph or a Kangxi radical is the unified ideograph it normalizes to.
    const unified = char.normalize('NFKC')
    if (unified !== char && [...unified].length === 1 && table.has(unified)) {
      induced.push([char, point(char), style, table.get(unified).join(' '), 'equivalent', unified, source])
      equivalent++
      continue
    }
    const sequence = described(char, region), tree = sequence ? parse(sequence) : null
    const written = tree && !('leaf' in tree) ? ordersOf(tree, table, through) : null
    if (written) { induced.push([char, point(char), style, written.slice(0, WAYS).join(' '), 'ids', sequence, source]); fromIds++ } else none++
  }
  return { style, source, recorded: table.size, equivalent, ids: fromIds, none }
})

// --- The files -----------------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })
/** @param {string} name @param {string[]} columns @param {string[][]} rows */
function write(name, columns, rows) {
  const body = [columns.join('\t'), ...rows.map(row => row.join('\t'))].join('\n') + '\n'
  writeFileSync(new URL(name, OUT), gzipSync(body, { level: 9, mtime: 0 }))
  return { name, rows: rows.length, columns, bytes: statSync(new URL(name, OUT)).size }
}
const files = [
  write('rime-stroke.tsv.gz', ['char', 'codepoint', 'orders'],
    [...rime.keys()].sort(byCodePoint).map(char => [char, point(char), rime.get(char).join(' ')])),
  write('cns11643.tsv.gz', ['char', 'codepoint', 'orders', 'cns'],
    [...cns.keys()].sort(byCodePoint).map(char => [char, point(char), cns.get(char).join(' '), cnsCodes.get(char).join(' ')])),
  write('induced.tsv.gz', ['char', 'codepoint', 'style', 'orders', 'basis', 'from', 'source'], induced),
]
const manifest = {
  format: 'ids-input/open-strokes',
  version: 1,
  strokes: { 横: { 'rime-stroke': 'h', cns11643: '1' }, 豎: { 'rime-stroke': 's', cns11643: '2' }, 撇: { 'rime-stroke': 'p', cns11643: '3' }, 點: { 'rime-stroke': 'n', cns11643: '4' }, 折: { 'rime-stroke': 'z', cns11643: '5' } },
  sources: [
    {
      key: 'rime-stroke', style: 'mainland', name: 'Rime five-stroke dictionary (stroke.dict.yaml)',
      authors: '四季的風, 雪齋, Kunki Chou, 宋天', url: 'https://github.com/rime/rime-stroke', revision: RIME.revision, sha256: RIME.sha256,
      licence: { spdx: 'LGPL-3.0-only', url: 'https://www.gnu.org/licenses/lgpl-3.0.html' },
    },
    {
      key: 'cns11643', style: 'taiwan', name: 'CNS11643 中文標準交換碼全字庫, CNS_strokes_sequence.txt',
      authors: '數位發展部', url: 'https://www.cns11643.gov.tw/', files: [{ url: CNS.properties, sha256: properties.sha256 }, { url: CNS.mapping, sha256: mapping.sha256 }],
      licence: { name: '政府資料開放授權條款-第1版 (Open Government Data License, version 1.0)', url: 'https://data.gov.tw/license' },
      attribution: '數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。',
    },
    {
      key: 'babelstone-ids', name: 'BabelStone IDS (IDS.TXT), the descriptions induced rows are written from',
      authors: 'Andrew West (魏安)', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT', version: idsText.split('\n')[0].replace(/^# /, ''),
      licence: { name: 'Public domain' },
    },
  ],
  induction: { operators: RELIABLE, ways: WAYS, validation },
  coverage: left,
  files,
}
writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2) + '\n')
for (const row of left) console.log(`${row.style}: ${row.recorded} recorded, ${row.equivalent} by equivalence, ${row.ids} from descriptions, ${row.none} without an order`)
for (const { style, operators } of validation) {
  const kept = operators.filter(row => row.induced), written = kept.reduce((sum, row) => sum + row.written, 0), agree = kept.reduce((sum, row) => sum + row.agree, 0)
  console.log(`${style}: the induced operators agree on ${agree} of ${written} recorded characters (${(100 * agree / written).toFixed(1)}%)`)
}
