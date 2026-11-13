// Build `data/open-strokes/`: the stroke order of Han characters, each row from a named source or
// induced from one and marked so.
//
//   cns11643.tsv.gz     Taiwan's standard order, as CNS 全字庫 records it (Open Government Data License 1.0)
//   rime-stroke.tsv.gz  Rime's five-stroke dictionary: the CNS table with the orders its authors
//                       added, through Extension J (LGPL-3.0)
//   induced.tsv.gz      characters a source lacks, written from a character the source has:
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
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
  // The dictionary also lists Tangut and the CJK strokes; the release holds Han characters.
  if (!char || !code || [...char].length !== 1 || !/^[hspnz]+$/.test(code) || characterScript(char) !== 'han') continue
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
    return { seq: found?.[1] ?? text, regions: found?.[2] ?? '' }
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
    // 〾 marks a description as a variation of the form, not the form itself: nothing is induced from it.
    if (char === undefined || char === '{' || char === '？' || char === '〾') throw Error('unreadable')
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

// Both tables follow Taiwan's standard forms, so a character is read by its T-source description.
const SOURCES = [
  { source: 'cns11643', table: cns, region: 'T' },
  { source: 'rime-stroke', table: rime, region: 'T' },
]
const LETTER = { h: '1', s: '2', p: '3', n: '4', z: '5' }
/** A Rime code in the digits CNS writes, for comparing the two. @param {string} code */
const digits = code => [...code].map(letter => LETTER[letter]).join('')
// How often the rules write a recorded character the way its source does, by the description's
// outer operator.
const validation = SOURCES.map(({ source, table, region }) => {
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
  return { source, operators: [...byOperator].sort((a, b) => b[1].described - a[1].described).map(([operator, tally]) => ({ operator, ...tally, induced: RELIABLE.includes(operator) })) }
})

const repertoire = JSON.parse(gunzipSync(readFileSync(new URL('../data/han-parts.json.gz', import.meta.url)))).keys
// BabelStone IDS also describes Tangut; only Han characters are counted and induced.
const candidates = [...new Set([...repertoire, ...ids.keys()])].filter(char => characterScript(char) === 'han').sort(byCodePoint)
const through = new Set(RELIABLE)
/** @type {string[][]} */
const induced = []
const left = SOURCES.map(({ source, table, region }) => {
  let equivalent = 0, fromIds = 0, none = 0
  for (const char of candidates) {
    if (table.has(char)) continue
    // A compatibility ideograph or a Kangxi radical is the unified ideograph it normalizes to.
    const unified = char.normalize('NFKC')
    if (unified !== char && [...unified].length === 1 && table.has(unified)) {
      induced.push([char, point(char), table.get(unified).join(' '), 'equivalent', unified, source])
      equivalent++
      continue
    }
    const sequence = described(char, region), tree = sequence ? parse(sequence) : null
    const written = tree && !('leaf' in tree) ? ordersOf(tree, table, through) : null
    if (written) { induced.push([char, point(char), written.slice(0, WAYS).join(' '), 'ids', sequence, source]); fromIds++ } else none++
  }
  return { source, recorded: table.size, equivalent, ids: fromIds, none }
})
// The two sources on the characters both record, and the orders induced from CNS against what Rime
// records for the same characters: rows neither the rules nor the CNS table had seen.
const shared = [...cns.keys()].filter(char => rime.has(char))
const same = char => rime.get(char).some(code => cns.get(char).includes(digits(code)))
const BLOCKS = [['URO and earlier', 0x9fff], ['Extension B', 0x2a6df], ['Extension C', 0x2b73f], ['Extension D', 0x2b81f], ['Extension E', 0x2ceaf], ['Extension F and later', 0x10ffff]]
const blockOf = char => BLOCKS.find(([, last]) => char.codePointAt(0) <= last)[0]
const agreement = {
  shared: shared.length,
  sameOrder: shared.filter(same).length,
  blocks: BLOCKS.map(([block]) => { const chars = shared.filter(char => blockOf(char) === block); return { block, shared: chars.length, sameOrder: chars.filter(same).length } }),
}
const heldOut = induced.filter(row => row[5] === 'cns11643' && row[3] === 'ids' && rime.has(row[0]))
const heldOutAgree = heldOut.filter(row => rime.get(row[0]).some(code => row[2].split(' ').includes(digits(code)))).length

// --- The files -----------------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })
/** @param {string} name @param {string[]} columns @param {string[][]} rows */
function write(name, columns, rows) {
  const body = [columns.join('\t'), ...rows.map(row => row.join('\t'))].join('\n') + '\n'
  writeFileSync(new URL(name, OUT), gzipSync(body, { level: 9, mtime: 0 }))
  return { name, rows: rows.length, columns, bytes: statSync(new URL(name, OUT)).size }
}
const files = [
  write('cns11643.tsv.gz', ['char', 'codepoint', 'orders', 'cns'],
    [...cns.keys()].sort(byCodePoint).map(char => [char, point(char), cns.get(char).join(' '), cnsCodes.get(char).join(' ')])),
  write('rime-stroke.tsv.gz', ['char', 'codepoint', 'orders'],
    [...rime.keys()].sort(byCodePoint).map(char => [char, point(char), rime.get(char).join(' ')])),
  write('induced.tsv.gz', ['char', 'codepoint', 'orders', 'basis', 'from', 'source'], induced),
]
// The LGPL asks that its text, and the GPL's it builds on, travel with the data.
const LICENCES = { 'rime-stroke-LGPL-3.0.txt': 'LICENSE-rime-stroke-LGPL-3.0.txt', 'GPL-3.0.txt': 'LICENSE-GPL-3.0.txt', 'rime-stroke-AUTHORS.txt': 'AUTHORS-rime-stroke.txt' }
for (const [from, to] of Object.entries(LICENCES)) copyFileSync(new URL(`../data/licences/${from}`, import.meta.url), new URL(to, OUT))
const manifest = {
  format: 'ids-input/open-strokes',
  version: 1,
  strokes: { 横: { cns11643: '1', 'rime-stroke': 'h' }, 豎: { cns11643: '2', 'rime-stroke': 's' }, 撇: { cns11643: '3', 'rime-stroke': 'p' }, 點: { cns11643: '4', 'rime-stroke': 'n' }, 折: { cns11643: '5', 'rime-stroke': 'z' } },
  sources: [
    {
      key: 'cns11643', name: 'CNS11643 中文標準交換碼全字庫, CNS_strokes_sequence.txt',
      authors: '數位發展部', url: 'https://www.cns11643.gov.tw/', files: [{ url: CNS.properties, sha256: properties.sha256 }, { url: CNS.mapping, sha256: mapping.sha256 }],
      licence: { name: '政府資料開放授權條款-第1版 (Open Government Data License, version 1.0)', url: 'https://data.gov.tw/license' },
      attribution: '數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。',
    },
    {
      key: 'rime-stroke', name: 'Rime five-stroke dictionary (stroke.dict.yaml)',
      authors: '四季的風, 雪齋, Kunki Chou, 宋天', url: 'https://github.com/rime/rime-stroke', revision: RIME.revision, sha256: RIME.sha256,
      licence: { spdx: 'LGPL-3.0-only', url: 'https://www.gnu.org/licenses/lgpl-3.0.html', texts: Object.values(LICENCES) },
      changes: 'Reduced to the Han characters with a complete five-class code, one row per character, in code point order.',
    },
    {
      key: 'babelstone-ids', name: 'BabelStone IDS (IDS.TXT), the descriptions induced rows are written from',
      authors: 'Andrew West (魏安)', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT', version: idsText.split('\n')[0].replace(/^# /, ''),
      licence: { name: 'Public domain' },
    },
  ],
  agreement: { ...agreement, inducedAgainstRime: { rows: heldOut.length, agree: heldOutAgree } },
  induction: { operators: RELIABLE, ways: WAYS, validation },
  coverage: left,
  files,
  texts: ['README.md', ...Object.values(LICENCES)],
}
const n = value => value.toLocaleString('en')
const file = name => files.find(entry => entry.name === name)
const cover = key => left.find(row => row.source === key)
const scores = key => ['| Operator | Described | Written | Agree | | Induced |', '| --- | ---: | ---: | ---: | ---: | --- |',
  ...validation.find(row => row.source === key).operators.map(row => `| ${row.operator} | ${n(row.described)} | ${n(row.written)} | ${n(row.agree)} | ${row.written ? (100 * row.agree / row.written).toFixed(1) + '%' : ''} | ${row.induced ? 'yes' : 'no'} |`)].join('\n')
const kept = validation.find(row => row.source === 'cns11643').operators.filter(row => row.induced)
const keptRate = (100 * kept.reduce((sum, row) => sum + row.agree, 0) / kept.reduce((sum, row) => sum + row.written, 0)).toFixed(1)
writeFileSync(new URL('README.md', OUT), `# Open stroke orders

The stroke order of Han characters, from two sources, with orders induced for the characters a
source lacks. Every row names where it comes from; an induced row is never mixed into a source's
file.

The format is \`ids-input/open-strokes\`, version 1.

## Files

| File | Rows | |
| --- | ---: | --- |
| \`cns11643.tsv.gz\` | ${n(file('cns11643.tsv.gz').rows)} | Taiwan's standard order, from CNS 全字庫: \`char\`, \`codepoint\`, \`orders\`, \`cns\` (the CNS plane-codes mapped to the character). Open Government Data License 1.0. |
| \`rime-stroke.tsv.gz\` | ${n(file('rime-stroke.tsv.gz').rows)} | Rime's five-stroke dictionary: \`char\`, \`codepoint\`, \`orders\`. LGPL-3.0. |
| \`induced.tsv.gz\` | ${n(file('induced.tsv.gz').rows)} | Induced orders: \`char\`, \`codepoint\`, \`orders\`, \`basis\`, \`from\`, \`source\`. Each row keeps the terms of its \`source\`. |
| \`manifest.json\` | | Sources with checksums, licences, coverage and the tables below. |
| \`LICENSE-rime-stroke-LGPL-3.0.txt\`, \`LICENSE-GPL-3.0.txt\`, \`AUTHORS-rime-stroke.txt\` | | The terms and authors of the Rime dictionary. |

The data files are gzipped UTF-8 TSV with a header row. \`orders\` holds one code per way of writing
the character, separated by a space, in the source's order.

## Strokes

A code is one symbol per stroke in writing order, in the five classes. Each file keeps its source's
symbols.

| Class | \`cns11643\` | \`rime-stroke\` |
| --- | --- | --- |
| 横 horizontal | \`1\` | \`h\` |
| 豎 vertical | \`2\` | \`s\` |
| 撇 left-falling | \`3\` | \`p\` |
| 點 dot | \`4\` | \`n\` |
| 折 turning | \`5\` | \`z\` |

Neither source gives stroke paths, and neither gives mainland, Japanese or Korean standard order.

## The two sources are not two styles

The Rime dictionary states that its main table comes from CNS 全字庫 and that its data beyond
Extension D was added by its authors. The files bear that out: of the ${n(agreement.shared)} characters both
record, ${n(agreement.sameOrder)} have an order in common, and the agreement drops where the CNS-derived part ends.

| Block | In both | Same order |
| --- | ---: | ---: |
${agreement.blocks.map(row => `| ${row.block} | ${n(row.shared)} | ${n(row.sameOrder)} |`).join('\n')}

Through Extension D the Rime file is CNS order with added alternatives. In Extension E about half
of the shared characters differ (the 馬 component begins \`hs\` in Rime's rows there and \`21\` in
CNS), so Rime's own additions do not all follow CNS order. This project has not identified the
convention they follow.

## Induced rows

\`basis\` says how the order was written.

- \`equivalent\`: the character is a compatibility ideograph or a radical form, and \`from\` is the
  unified ideograph it normalizes to (NFKC). The row repeats that character's recorded orders.
  ${n(cover('cns11643').equivalent)} rows from \`cns11643\`, ${n(cover('rime-stroke').equivalent)} from \`rime-stroke\`.
- \`ids\`: \`from\` is the character's description in BabelStone IDS (the sequence its T source gives,
  else the first), and the order joins the recorded orders of its components.
  ${n(cover('cns11643').ids)} rows from \`cns11643\`, ${n(cover('rime-stroke').ids)} from \`rime-stroke\`. Up to ${WAYS} ways are kept.

The components are joined in the order the description names them, except:

- ⿺ with 辶 or 廴 as the enclosure, and ⿶: what is held is written first.
- ⿴: the enclosure without its last stroke, then what it holds, then that stroke.
- ⿷: the enclosure's first stroke, then what it holds, then the rest.

An order is induced only through ${RELIABLE.join(' ')}, at every level of the description, and only
when every component has a recorded order in the same source. A description BabelStone marks 〾 is
not used. Nothing is induced from another induced row.

### How often the rules agree with a source

Each recorded character with a description was written by the same rules from the same source and
compared with its recorded orders. "Written" counts the characters whose components all have orders;
"Agree" those where one written order is a recorded one. Rows are the description's outer operator.

\`cns11643\`:

${scores('cns11643')}

\`rime-stroke\`:

${scores('rime-stroke')}

An induced row is a prediction, not a record. Over the operators induced through, the rules agree
with CNS on ${keptRate}% of the characters CNS records. The rows induced from CNS cannot be checked against the
Rime file: Rime records ${n(heldOut.length)} of those characters and ${n(heldOutAgree)} agree, since Rime's
additions do not all follow CNS order.

## Coverage

| Source | Recorded | By equivalence | From IDS | Without an order |
| --- | ---: | ---: | ---: | ---: |
${left.map(row => `| \`${row.source}\` | ${n(row.recorded)} | ${n(row.equivalent)} | ${n(row.ids)} | ${n(row.none)} |`).join('\n')}

"Without an order" counts the Han characters the workshop's composer draws or BabelStone IDS
describes that end with no row from that source.

## Sources and terms

- CNS11643 中文標準交換碼全字庫, \`CNS_strokes_sequence.txt\` in \`Properties.zip\` and the Unicode
  tables in \`MapingTables.zip\`, <https://www.cns11643.gov.tw/>. 政府資料開放授權條款-第1版 (Open
  Government Data License, version 1.0), <https://data.gov.tw/license>. Attribution:
  數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。 The archives carry no
  version; \`manifest.json\` records the SHA-256 of the copies read. Private Use code points are left out.
- Rime five-stroke dictionary, \`stroke.dict.yaml\`, revision
  \`${RIME.revision}\`, <https://github.com/rime/rime-stroke>. Authors: 四季的風, 雪齋,
  Kunki Chou and 宋天; the table credits CNS11643, 北大中文論壇 and 宋天's extension data.
  LGPL-3.0; the licence texts are beside this file. \`rime-stroke.tsv.gz\` is a modified form of the
  dictionary: reduced to the Han characters with a complete five-class code, one row per
  character, in code point order.
- BabelStone IDS, \`IDS.TXT\`, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, public
  domain: the descriptions induced rows are written from.

## Rebuild

\`bun scripts/build_open_strokes.mjs\` fetches the sources and writes the files, this one included.
`)
writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2) + '\n')
for (const row of left) console.log(`${row.source}: ${row.recorded} recorded, ${row.equivalent} by equivalence, ${row.ids} from descriptions, ${row.none} without an order`)
console.log(`same order in both sources: ${agreement.sameOrder} of ${agreement.shared}`)
console.log(`induced from CNS, against Rime: ${heldOutAgree} of ${heldOut.length} (${(100 * heldOutAgree / heldOut.length).toFixed(1)}%)`)
