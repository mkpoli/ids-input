// Build `data/open-strokes/`: the stroke order of Han characters, each row from a named source or
// induced from one and marked so.
//
//   cns11643.tsv.gz     Taiwan's standard order, as CNS 全字庫 records it (Open Government Data License 1.0)
//   rime-stroke.tsv.gz  Rime's five-stroke dictionary: the CNS table with the orders its authors
//                       added, through Extension J (LGPL-3.0)
//   kanjivg.tsv.gz      Japanese order, as KanjiVG draws it stroke by stroke (CC BY-SA 3.0)
//   entered.tsv         orders entered by hand in `data/stroke-orders-entered.tsv`, each with its basis
//   wanted.tsv          the components whose order would let the most characters be written
//   induced.tsv.gz      characters a source lacks, written from a character the source has:
//                       the unified ideograph a compatibility form or radical is equivalent to, or
//                       the components of its ideographic description sequence
//
// An induced order joins the orders of a description's components. The side-by-side and stacked
// operators join them in order. An enclosure is written around what it holds at a place learned,
// enclosure by enclosure, from the characters the source records; one too rare to learn from takes
// its operator's usual place, and ⿹ and ⿻ are induced through only where a place was learned. The
// manifest carries the places and how often they agree with the source on characters they were
// not learned from.
//
//   bun scripts/build_open_strokes.mjs [stroke.dict.yaml] [Properties.zip] [MapingTables.zip] [kanjivg directory]
//
// Local copies skip the downloads. The CNS archives are not versioned upstream, so the manifest
// records the SHA-256 of the copies read.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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
const KANJIVG = {
  revision: '610091ce618cf757ed1357a8954cd65283e015d6',
  url: 'https://codeload.github.com/KanjiVG/kanjivg/zip/610091ce618cf757ed1357a8954cd65283e015d6',
}
/** The operators an order is induced through whatever their components are. */
const RELIABLE = ['⿰', '⿱', '⿲', '⿳', '⿴', '⿵', '⿶', '⿷', '⿸', '⿺']
/** The operators whose first component encloses, crosses or carries the second. */
const ENCLOSING = new Set([...'⿴⿵⿶⿷⿸⿹⿺⿻'])
/** Where the held part is written among the enclosure's strokes: the index it is put in at. */
const PLACEMENTS = /** @type {Record<string, (outer: string) => number>} */ ({
  'outer-first': outer => outer.length, 'inner-first': () => 0, 'after-1': () => 1, 'after-2': () => 2, 'after-3': () => 3,
  'before-last': outer => outer.length - 1, 'before-last-2': outer => outer.length - 2,
})
/** How many recorded characters an enclosure needs, and how many of them its place must write right, to be learned. */
const SUPPORT = 5, AGREEMENT = 0.9
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

// KanjiVG draws one path per stroke, in writing order, and names each stroke's type with a CJK
// stroke character: ㇐, ㇑a, ㇔/㇏. The types are kept as written; the five-class code beside them is
// this project's reading, each type by the class `data/ids-parts.json` gives its stroke character,
// the first where KanjiVG offers two, with the letter that tells its variants apart left out.
let kanjivgDir = process.argv[5]
if (!kanjivgDir) {
  const archive = join(scratch, 'kanjivg.zip')
  writeFileSync(archive, Buffer.from(await (await fetch(KANJIVG.url)).arrayBuffer()))
  execFileSync('unzip', ['-q', '-o', archive, 'kanjivg-*/kanji/*', '-d', scratch])
  kanjivgDir = join(scratch, `kanjivg-${KANJIVG.revision}`)
}
const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8'))
const DIGIT = { 横: '1', 豎: '2', 撇: '3', 點: '4', 折: '5' }
/** @type {Map<string, string>} */
const classOf = new Map(palette.parts.filter(row => row[5] === 's' && row[4]).map(row => [row[0], DIGIT[row[4]]]))
/** @type {Map<string, string[]>} Each kanji's order in the five classes. */
const kanjivg = new Map()
/** @type {Map<string, string[]>} Each kanji's stroke types, as KanjiVG writes them. */
const kanjivgTypes = new Map()
for (const name of readdirSync(join(kanjivgDir, 'kanji')).sort()) {
  // A file named for the code point alone is the standard form; the others are variants.
  if (!/^[0-9a-f]{5}\.svg$/.test(name)) continue
  const char = String.fromCodePoint(parseInt(name.slice(0, 5), 16))
  if (characterScript(char) !== 'han') continue
  const svg = readFileSync(join(kanjivgDir, 'kanji', name), 'utf8')
  const strokes = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"(?:\s+kvg:type="([^"]*)")?/g)]
  const types = strokes.map(found => found[2] ?? '')
  const classes = types.map(type => classOf.get([...type][0] ?? ''))
  // A kanji with a stroke KanjiVG leaves untyped, or types outside the stroke table, is left out whole.
  if (!strokes.length || strokes.some((found, index) => Number(found[1]) !== index + 1) || classes.some(digit => !digit)) continue
  kanjivg.set(char, [classes.join('')])
  kanjivgTypes.set(char, types)
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
// Yi Bai's descriptions stand in where BabelStone has none. They carry no source regions.
/** @type {Map<string, string>} */
const second = new Map()
const secondText = gunzipSync(readFileSync(new URL('../data/yi-bai-ids.tsv.gz', import.meta.url))).toString()
for (const line of secondText.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, sequences] = line.split('\t')
  if (sequences && [...char].length === 1) second.set(char, sequences.split(' ')[0])
}
/** @type {Map<string, string>} BabelStone's numbered components, each as the fragment that writes it out. */
const fragments = new Map()
for (const line of readFileSync(new URL('../data/ids-components.tsv', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [number, , fragment] = line.split('\t')
  if (fragment) fragments.set(number, fragment)
}
/** A description with its numbered components written out; one without a fragment stays, unreadable. @param {string} sequence */
const writtenOut = sequence => sequence.replace(/\{\d+\}/g, number => fragments.get(number) ?? number)
/** @typedef {{ leaf: string } | { op: string, parts: Tree[] }} Tree */
/** @param {string} sequence @returns {Tree | null} */
function parse(sequence) {
  const chars = [...writtenOut(sequence)]
  let at = 0
  /** @returns {Tree} */
  const node = () => {
    const char = chars[at++]
    // 〾 marks a description as a variation of the form, not the form itself: nothing is induced from it.
    // A bracket opens an operator modifier of Yi Bai's notation, which the rules do not read.
    if (char === undefined || char === '{' || char === '[' || char === '？' || char === '〾') throw Error('unreadable')
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
/** The enclosure written with the held part at a place, or null where the enclosure has too few strokes. @param {string} name @param {string} outer @param {string} inner */
function placed(name, outer, inner) {
  const at = PLACEMENTS[name](outer)
  return at < 0 || at > outer.length ? null : outer.slice(0, at) + inner + outer.slice(at)
}
/** The place an operator's enclosure usually takes: a walking or open-topped one is written last, a full one is closed by its last stroke, a left-open one begins with its top stroke. @param {Tree & { op: string }} tree */
const usualPlace = tree => tree.op === '⿶' || tree.op === '⿺' && 'leaf' in tree.parts[0] && WALKING.has(tree.parts[0].leaf) ? 'inner-first'
  : tree.op === '⿴' ? 'before-last' : tree.op === '⿷' ? 'after-1' : 'outer-first'
/**
 * The orders a description is written in, from its components' orders. A component the table does
 * not record is read by its own description in turn. With `learned`, an order is written only
 * through the operators induced through; without it, every operator is tried at its usual place.
 * Null when a component cannot be written.
 * @param {Tree} tree @param {Map<string, string[]>} table @param {string} region
 * @param {Map<string, string> | null} learned The place of each enclosure, keyed operator then enclosure.
 * @param {string[]} [within] The components being read, so none is read inside itself.
 * @returns {string[] | null}
 */
function ordersOf(tree, table, region, learned, within = []) {
  if ('leaf' in tree) {
    const recorded = table.get(tree.leaf)
    if (recorded || within.includes(tree.leaf)) return recorded ?? null
    const sequence = described(tree.leaf, region), inner = sequence ? parse(sequence) : null
    return inner && !('leaf' in inner) ? ordersOf(inner, table, region, learned, [...within, tree.leaf]) : null
  }
  const place = ENCLOSING.has(tree.op) && 'leaf' in tree.parts[0] ? learned?.get(tree.op + tree.parts[0].leaf) : undefined
  if (learned && !place && !RELIABLE.includes(tree.op)) return null
  const parts = tree.parts.map(part => ordersOf(part, table, region, learned, within))
  if (parts.some(part => !part)) return null
  if (!ENCLOSING.has(tree.op)) return joined(/** @type {string[][]} */ (parts))
  const [outer, inner] = /** @type {string[][]} */ (parts), name = place ?? usualPlace(tree)
  const written = [...new Set(outer.flatMap(frame => inner.map(held => placed(name, frame, held))).filter(order => order !== null))]
  return written.length ? /** @type {string[]} */ (written.slice(0, 64)) : null
}
/**
 * The place each enclosure is written at, learned from the recorded characters `use` admits whose
 * description has it as the first component of an enclosing operator.
 * @param {Map<string, string[]>} table @param {string} region @param {(char: string) => boolean} use
 */
function learn(table, region, use) {
  /** @type {Map<string, { operator: string, enclosure: string, usual: string, support: number, agree: Record<string, number> }>} */
  const tallies = new Map()
  for (const [char, recorded] of table) {
    if (!use(char)) continue
    const sequence = described(char, region), tree = sequence ? parse(sequence) : null
    if (!tree || 'leaf' in tree || !ENCLOSING.has(tree.op) || !('leaf' in tree.parts[0])) continue
    const outer = table.get(tree.parts[0].leaf), inner = ordersOf(tree.parts[1], table, region, null)
    if (!outer || !inner) continue
    const key = tree.op + tree.parts[0].leaf
    const tally = tallies.get(key) ?? tallies.set(key, { operator: tree.op, enclosure: tree.parts[0].leaf, usual: usualPlace(tree), support: 0, agree: {} }).get(key)
    tally.support++
    for (const name of Object.keys(PLACEMENTS)) {
      if (outer.some(frame => inner.some(held => recorded.includes(placed(name, frame, held) ?? '')))) tally.agree[name] = (tally.agree[name] ?? 0) + 1
    }
  }
  /** @type {Map<string, string>} */
  const places = new Map()
  const rules = []
  for (const [key, tally] of tallies) {
    if (tally.support < SUPPORT) continue
    // The usual place wins a tie, so a short enclosure does not learn a place that only its length allows.
    const [name, agree] = Object.entries(tally.agree).sort((a, b) => b[1] - a[1] || Number(b[0] === tally.usual) - Number(a[0] === tally.usual))[0] ?? ['', 0]
    if (agree / tally.support < AGREEMENT) continue
    places.set(key, name)
    rules.push({ operator: tally.operator, enclosure: tally.enclosure, place: name, support: tally.support, agree })
  }
  return { places, rules: rules.sort((a, b) => a.operator.localeCompare(b.operator) || b.support - a.support) }
}
/** The description a style reads a character by: BabelStone's for its region, else its first, else Yi Bai's. @param {string} char @param {string} region */
const described = (char, region) => { const list = ids.get(char); return list ? (list.find(entry => entry.regions.includes(region)) ?? list[0]).seq : second.get(char) ?? null }
/** The source of the description `described` gives. @param {string} char */
const describedBy = char => ids.has(char) ? 'babelstone-ids' : 'yi-bai-ids'

// The two Chinese tables follow Taiwan's standard forms, so a character is read by its T-source
// description; KanjiVG's by its J-source one.
const SOURCES = [
  { source: 'cns11643', table: cns, region: 'T' },
  { source: 'rime-stroke', table: rime, region: 'T' },
  { source: 'kanjivg', table: kanjivg, region: 'J' },
]
const LETTER = { h: '1', s: '2', p: '3', n: '4', z: '5' }
/** A Rime code in the digits CNS writes, for comparing the two. @param {string} code */
const digits = code => [...code].map(letter => LETTER[letter]).join('')
// The places learned from all of a source's characters, which the induced rows are written with.
const learned = new Map(SOURCES.map(({ source, table, region }) => [source, learn(table, region, () => true)]))
// How often the rules write a recorded character the way its source does, by the description's
// outer operator. Each character is written with places learned from the other half of the
// characters, split by code point parity, so no character scores a place it taught.
const even = char => char.codePointAt(0) % 2 === 0
const validation = SOURCES.map(({ source, table, region }) => {
  const halves = [learn(table, region, char => !even(char)).places, learn(table, region, even).places]
  /** @type {Map<string, { described: number, written: number, agree: number }>} */
  const byOperator = new Map()
  for (const [char, recorded] of table) {
    const sequence = described(char, region), tree = sequence ? parse(sequence) : null
    if (!tree || 'leaf' in tree) continue
    const tally = byOperator.get(tree.op) ?? byOperator.set(tree.op, { described: 0, written: 0, agree: 0 }).get(tree.op)
    tally.described++
    const written = ordersOf(tree, table, region, halves[even(char) ? 0 : 1])
    if (!written) continue
    tally.written++
    if (written.some(order => recorded.includes(order))) tally.agree++
  }
  const taught = new Set(learned.get(source).rules.map(rule => rule.operator))
  return { source, operators: [...byOperator].sort((a, b) => b[1].described - a[1].described).map(([operator, tally]) => ({ operator, ...tally, induced: RELIABLE.includes(operator) ? 'always' : taught.has(operator) ? 'learned' : 'never' })) }
})

// --- Orders entered by hand ----------------------------------------------------------------------

const SYMBOLS = { cns11643: /^[1-5]+( [1-5]+)*$/, 'rime-stroke': /^[hspnz]+( [hspnz]+)*$/, kanjivg: /^[1-5]+( [1-5]+)*$/ }
/** @type {string[][]} */
const enteredRows = []
for (const [index, line] of readFileSync(new URL('../data/stroke-orders-entered.tsv', import.meta.url), 'utf8').split('\n').entries()) {
  if (!line || line.startsWith('#')) continue
  const [char, source, orders, basis, by, date] = line.split('\t')
  const at = `data/stroke-orders-entered.tsv:${index + 1}`
  // A component can be a CJK stroke or a letter a description borrows, so any one character is taken.
  if ([...(char ?? '')].length !== 1) throw Error(`${at}: one character per row`)
  if (!SYMBOLS[source]?.test(orders ?? '')) throw Error(`${at}: orders must be written in the symbols of cns11643, rime-stroke or kanjivg`)
  if (!basis || !by || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw Error(`${at}: a basis, who entered it and the date are required`)
  if (enteredRows.some(row => row[0] === char && row[5] === source)) throw Error(`${at}: ${char} is entered twice for ${source}`)
  enteredRows.push([char, point(char), orders, basis, by, source, date])
}
enteredRows.sort((a, b) => a[5].localeCompare(b[5]) || byCodePoint(a[0], b[0]))

const repertoire = JSON.parse(gunzipSync(readFileSync(new URL('../data/han-parts.json.gz', import.meta.url)))).keys
// BabelStone IDS also describes Tangut; only Han characters are counted and induced.
const candidates = [...new Set([...repertoire, ...ids.keys(), ...second.keys()])].filter(char => characterScript(char) === 'han').sort(byCodePoint)
/** The marker of a description that stops at an operator not induced through. */
const OPERATOR = '\0'
/**
 * What keeps a description from being written: the components without an order, read down to the
 * smallest, or OPERATOR. Follows `ordersOf`.
 * @param {Tree} tree @param {Map<string, string[]>} table @param {string} region @param {Map<string, string>} places
 * @param {string[]} [within] @returns {Set<string>}
 */
function blockersOf(tree, table, region, places, within = []) {
  if ('leaf' in tree) {
    if (table.has(tree.leaf)) return new Set()
    const sequence = within.includes(tree.leaf) ? null : described(tree.leaf, region), inner = sequence ? parse(sequence) : null
    if (!inner || 'leaf' in inner) return new Set([tree.leaf])
    const below = blockersOf(inner, table, region, places, [...within, tree.leaf])
    // A component whose own description cannot be induced through is wanted itself.
    return below.has(OPERATOR) ? new Set([tree.leaf]) : below
  }
  const place = ENCLOSING.has(tree.op) && 'leaf' in tree.parts[0] ? places.get(tree.op + tree.parts[0].leaf) : undefined
  if (!place && !RELIABLE.includes(tree.op)) return new Set([OPERATOR])
  return new Set(tree.parts.flatMap(part => [...blockersOf(part, table, region, places, within)]))
}
/** @type {string[][]} */
const induced = []
/** @type {string[][]} */
const wanted = []
const left = SOURCES.map(({ source, table, region }) => {
  // An entered order stands beside the source's: it writes its character and the characters it is a component of.
  const entered = new Map(enteredRows.filter(row => row[5] === source).map(row => [row[0], row[2].split(' ')]))
  const known = new Map([...table, ...[...entered].filter(([char]) => !table.has(char))])
  const places = learned.get(source).places
  let equivalent = 0, fromIds = 0, none = 0
  const reasons = { undescribed: 0, unreadable: 0, operator: 0, component: 0 }
  /** @type {Map<string, { blocks: string[], alone: number }>} */
  const blocking = new Map()
  for (const char of candidates) {
    if (known.has(char)) continue
    // A compatibility ideograph or a Kangxi radical is the unified ideograph it normalizes to.
    const unified = char.normalize('NFKC')
    if (unified !== char && [...unified].length === 1 && table.has(unified)) {
      induced.push([char, point(char), table.get(unified).join(' '), 'equivalent', unified, source, ''])
      equivalent++
      continue
    }
    const sequence = described(char, region), tree = sequence ? parse(sequence) : null
    const written = tree && !('leaf' in tree) ? ordersOf(tree, known, region, places) : null
    if (written) { induced.push([char, point(char), written.slice(0, WAYS).join(' '), 'ids', sequence, source, describedBy(char)]); fromIds++; continue }
    none++
    if (!sequence) { reasons.undescribed++; continue }
    if (!tree || 'leaf' in tree) { reasons.unreadable++; continue }
    const blockers = blockersOf(tree, known, region, places)
    if (blockers.has(OPERATOR) || !blockers.size) { reasons.operator++; continue }
    reasons.component++
    for (const component of blockers) {
      const entry = blocking.get(component) ?? blocking.set(component, { blocks: [], alone: 0 }).get(component)
      entry.blocks.push(char)
      if (blockers.size === 1) entry.alone++
    }
  }
  for (const [component, entry] of [...blocking].sort((a, b) => b[1].alone - a[1].alone || b[1].blocks.length - a[1].blocks.length || byCodePoint(a[0], b[0]))) {
    wanted.push([component, point(component), source, String(entry.blocks.length), String(entry.alone), entry.blocks.slice(0, 8).join('')])
  }
  return { source, recorded: table.size, entered: entered.size, equivalent, ids: fromIds, none, reasons }
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
/** A table, gzipped when its name says so. @param {string} name @param {string[]} columns @param {string[][]} rows */
function write(name, columns, rows) {
  const body = [columns.join('\t'), ...rows.map(row => row.join('\t'))].join('\n') + '\n'
  writeFileSync(new URL(name, OUT), name.endsWith('.gz') ? gzipSync(body, { level: 9, mtime: 0 }) : body)
  return { name, rows: rows.length, columns, bytes: statSync(new URL(name, OUT)).size }
}
const files = [
  write('cns11643.tsv.gz', ['char', 'codepoint', 'orders', 'cns'],
    [...cns.keys()].sort(byCodePoint).map(char => [char, point(char), cns.get(char).join(' '), cnsCodes.get(char).join(' ')])),
  write('rime-stroke.tsv.gz', ['char', 'codepoint', 'orders'],
    [...rime.keys()].sort(byCodePoint).map(char => [char, point(char), rime.get(char).join(' ')])),
  write('kanjivg.tsv.gz', ['char', 'codepoint', 'orders', 'strokes'],
    [...kanjivg.keys()].sort(byCodePoint).map(char => [char, point(char), kanjivg.get(char).join(' '), kanjivgTypes.get(char).join(' ')])),
  write('induced.tsv.gz', ['char', 'codepoint', 'orders', 'basis', 'from', 'source', 'ids'], induced),
  write('entered.tsv', ['char', 'codepoint', 'orders', 'basis', 'by', 'source', 'date'], enteredRows),
  write('wanted.tsv', ['char', 'codepoint', 'source', 'blocks', 'alone', 'examples'], wanted),
]
// The LGPL asks that its text, and the GPL's it builds on, travel with the data.
const LICENCES = { 'rime-stroke-LGPL-3.0.txt': 'LICENSE-rime-stroke-LGPL-3.0.txt', 'GPL-3.0.txt': 'LICENSE-GPL-3.0.txt', 'rime-stroke-AUTHORS.txt': 'AUTHORS-rime-stroke.txt' }
// KanjiVG's terms ask for its name and a link, and for the same licence on what is built from it.
const KANJIVG_LICENCE = 'LICENSE-kanjivg-CC-BY-SA-3.0.txt'
writeFileSync(new URL(KANJIVG_LICENCE, OUT), `KanjiVG — kanjivg.tsv.gz and the rows of induced.tsv.gz whose source is kanjivg
================================================================================

Copyright (C) 2009/2010/2011 Ulrich Apel.

This work is distributed under the conditions of the Creative Commons
Attribution-Share Alike 3.0 Licence.

  https://creativecommons.org/licenses/by-sa/3.0/

KanjiVG's own header asks that its use be attributed by naming KanjiVG and
linking to its website:

  KanjiVG, https://kanjivg.tagaini.net

These tables are adapted from the per-character SVG files of KanjiVG at revision
${KANJIVG.revision}, <https://github.com/KanjiVG/kanjivg>:
each kanji reduced to the types of its strokes in writing order, with a
five-class code added by IDS Input. They are shared alike under the same licence.
`)
// Yi Bai's MIT terms travel with the descriptions quoted from that dataset.
const SECOND_LICENCE = 'LICENSE-yi-bai-ids-MIT.txt'
copyFileSync(new URL('../data/licences/yi-bai-ids-MIT.txt', import.meta.url), new URL(SECOND_LICENCE, OUT))
for (const [from, to] of Object.entries(LICENCES)) copyFileSync(new URL(`../data/licences/${from}`, import.meta.url), new URL(to, OUT))
const manifest = {
  format: 'ids-input/open-strokes',
  version: 2,
  strokes: { 横: { cns11643: '1', 'rime-stroke': 'h', kanjivg: '1' }, 豎: { cns11643: '2', 'rime-stroke': 's', kanjivg: '2' }, 撇: { cns11643: '3', 'rime-stroke': 'p', kanjivg: '3' }, 點: { cns11643: '4', 'rime-stroke': 'n', kanjivg: '4' }, 折: { cns11643: '5', 'rime-stroke': 'z', kanjivg: '5' } },
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
      key: 'kanjivg', name: 'KanjiVG, the stroke types of its kanji files',
      authors: 'Ulrich Apel and contributors', url: 'https://kanjivg.tagaini.net', repository: 'https://github.com/KanjiVG/kanjivg', revision: KANJIVG.revision,
      licence: { spdx: 'CC-BY-SA-3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/', texts: [KANJIVG_LICENCE] },
      changes: 'Reduced to each kanji\'s stroke types in writing order, with a five-class code added by this project.',
    },
    {
      key: 'babelstone-ids', name: 'BabelStone IDS (IDS.TXT), the descriptions induced rows are written from',
      authors: 'Andrew West (魏安)', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT', version: idsText.split('\n')[0].replace(/^# /, ''),
      licence: { name: 'Public domain' },
    },
    {
      key: 'yi-bai-ids', name: 'Yi Bai IDS, level 1: the descriptions used where BabelStone has none',
      authors: 'Yi Bai', url: 'https://github.com/yi-bai/ids', version: secondText.split('\n')[0].replace(/^# /, ''),
      licence: { spdx: 'MIT', url: 'https://opensource.org/license/mit', texts: [SECOND_LICENCE] },
    },
  ],
  agreement: { ...agreement, inducedAgainstRime: { rows: heldOut.length, agree: heldOutAgree } },
  induction: {
    operators: RELIABLE, ways: WAYS, places: Object.keys(PLACEMENTS), support: SUPPORT, agreement: AGREEMENT,
    learned: SOURCES.map(({ source }) => ({ source, rules: learned.get(source).rules })), validation,
  },
  coverage: left,
  files,
  texts: ['README.md', ...Object.values(LICENCES), KANJIVG_LICENCE, SECOND_LICENCE],
}
const n = value => value.toLocaleString('en')
const file = name => files.find(entry => entry.name === name)
const cover = key => left.find(row => row.source === key)
const scores = key => ['| Operator | Described | Written | Agree | | Induced |', '| --- | ---: | ---: | ---: | ---: | --- |',
  ...validation.find(row => row.source === key).operators.map(row => `| ${row.operator} | ${n(row.described)} | ${n(row.written)} | ${n(row.agree)} | ${row.written ? (100 * row.agree / row.written).toFixed(1) + '%' : ''} | ${row.induced} |`)].join('\n')
const kept = validation.find(row => row.source === 'cns11643').operators
const rulesOf = key => learned.get(key).rules
const crossing = key => rulesOf(key).filter(rule => !RELIABLE.includes(rule.operator)).map(rule => `${rule.operator}${rule.enclosure} ${rule.place} (${rule.agree} of ${rule.support})`).join(', ')
const keptRate = (100 * kept.reduce((sum, row) => sum + row.agree, 0) / kept.reduce((sum, row) => sum + row.written, 0)).toFixed(1)
writeFileSync(new URL('README.md', OUT), `# Open stroke orders

The stroke order of Han characters, from three sources, with orders induced for the characters a
source lacks. Every row names where it comes from; an induced row is never mixed into a source's
file.

The format is \`ids-input/open-strokes\`, version 2.

## Files

| File | Rows | |
| --- | ---: | --- |
| \`cns11643.tsv.gz\` | ${n(file('cns11643.tsv.gz').rows)} | Taiwan's standard order, from CNS 全字庫: \`char\`, \`codepoint\`, \`orders\`, \`cns\` (the CNS plane-codes mapped to the character). Open Government Data License 1.0. |
| \`rime-stroke.tsv.gz\` | ${n(file('rime-stroke.tsv.gz').rows)} | Rime's five-stroke dictionary: \`char\`, \`codepoint\`, \`orders\`. LGPL-3.0. |
| \`kanjivg.tsv.gz\` | ${n(file('kanjivg.tsv.gz').rows)} | Japanese order, from KanjiVG: \`char\`, \`codepoint\`, \`orders\`, \`strokes\` (KanjiVG's type of each stroke, as it writes them). CC BY-SA 3.0. |
| \`induced.tsv.gz\` | ${n(file('induced.tsv.gz').rows)} | Induced orders: \`char\`, \`codepoint\`, \`orders\`, \`basis\`, \`from\`, \`source\`, \`ids\`. Each row keeps the terms of its \`source\`. |
| \`entered.tsv\` | ${n(file('entered.tsv').rows)} | Orders entered by hand: \`char\`, \`codepoint\`, \`orders\`, \`basis\`, \`by\`, \`source\`, \`date\`. CC0 1.0. |
| \`wanted.tsv\` | ${n(file('wanted.tsv').rows)} | Components without an order that keep characters from being written: \`char\`, \`codepoint\`, \`source\`, \`blocks\`, \`alone\`, \`examples\`. CC0 1.0. |
| \`manifest.json\` | | Sources with checksums, licences, coverage and the tables below. |
| \`LICENSE-rime-stroke-LGPL-3.0.txt\`, \`LICENSE-GPL-3.0.txt\`, \`AUTHORS-rime-stroke.txt\` | | The terms and authors of the Rime dictionary. |
| \`LICENSE-kanjivg-CC-BY-SA-3.0.txt\` | | The terms of KanjiVG. |
| \`LICENSE-yi-bai-ids-MIT.txt\` | | The terms of Yi Bai's descriptions. |

The data files are UTF-8 TSV with a header row, gzipped where the name ends in \`.gz\`. \`orders\` holds one code per way of writing
the character, separated by a space, in the source's order.

## Strokes

A code is one symbol per stroke in writing order, in the five classes. Each file keeps its source's
symbols.

| Class | \`cns11643\` | \`rime-stroke\` | \`kanjivg\` |
| --- | --- | --- | --- |
| 横 horizontal | \`1\` | \`h\` | \`1\` |
| 豎 vertical | \`2\` | \`s\` | \`2\` |
| 撇 left-falling | \`3\` | \`p\` | \`3\` |
| 點 dot | \`4\` | \`n\` | \`4\` |
| 折 turning | \`5\` | \`z\` | \`5\` |

KanjiVG names each stroke's type with a CJK stroke character (㇐, ㇑a, ㇔/㇏), and \`strokes\` keeps
those as written. Its \`orders\` code is this project's reading of them, not KanjiVG's: each type
takes the class \`data/ids-parts.json\` gives its stroke character (a rising ㇀ is 横, a hooked ㇚
is 豎, a falling ㇏ is 點), the first where KanjiVG offers two. CNS classes some of the same strokes
otherwise, so a code from one source is not comparable stroke for stroke with another's.

No source here gives stroke paths, or mainland or Korean standard order.

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
  ${n(cover('cns11643').equivalent)} rows from \`cns11643\`, ${n(cover('rime-stroke').equivalent)} from \`rime-stroke\`, ${n(cover('kanjivg').equivalent)} from \`kanjivg\`.
- \`ids\`: \`from\` is the character's description and the order joins the recorded orders of
  its components. The description is BabelStone's (the sequence its T source gives, or its J
  source for \`kanjivg\`, else the first) or, where BabelStone has none, Yi Bai's; the \`ids\` column names which.
  ${n(cover('cns11643').ids)} rows from \`cns11643\` (${n(induced.filter(row => row[5] === 'cns11643' && row[6] === 'yi-bai-ids').length)} of them by Yi Bai's descriptions), ${n(cover('rime-stroke').ids)} from \`rime-stroke\`, ${n(cover('kanjivg').ids)} from \`kanjivg\`. Up to ${WAYS} ways are kept.

The components of ⿰ ⿱ ⿲ ⿳ are joined in the order the description names them. In the other
operators the first component encloses, crosses or carries the second, and the second is written at
a place among the first's strokes:

| Place | The held part is written |
| --- | --- |
| \`outer-first\` | after the whole enclosure |
| \`inner-first\` | before the enclosure |
| \`after-1\`, \`after-2\`, \`after-3\` | after the enclosure's first one, two or three strokes |
| \`before-last\`, \`before-last-2\` | before the enclosure's last one or two strokes |

The place is learned per enclosure from the characters the source records: an enclosure with at
least ${SUPPORT} such characters takes the place that writes the most of them as recorded, if that is
${Math.round(AGREEMENT * 100)}% or more. \`cns11643\` teaches ${rulesOf('cns11643').length} places, \`rime-stroke\` ${rulesOf('rime-stroke').length} and \`kanjivg\` ${rulesOf('kanjivg').length}; \`manifest.json\` lists them
under \`induction.learned\`. An enclosure without a learned place takes its operator's usual one:
\`inner-first\` for ⿶ and for ⿺ with 辶 or 廴, \`before-last\` for ⿴, \`after-1\` for ⿷, \`outer-first\` otherwise.

⿹ and ⿻ have no usual place that holds, so they are induced through only for the enclosures with a
learned one. In \`cns11643\`: ${crossing('cns11643')}.

${RELIABLE.join(' ')} are induced through at every level of the description. A component the source
does not record is read by its own description in turn, and one of BabelStone's numbered components
by the fragment its note 6 writes it out as; \`from\` keeps the description as its dataset spells
it. A description BabelStone marks 〾 is not used.

### How often the rules agree with a source

Each recorded character with a description was written by the same rules from the same source and
compared with its recorded orders, with the places learned from the other half of the characters
(split by code point parity), so none scores a place it taught. "Written" counts the characters the
rules write; "Agree" those where one written order is a recorded one. Rows are the description's
outer operator; "Induced" says whether it is induced through always, only where a place was
learned, or never.

\`cns11643\`:

${scores('cns11643')}

\`rime-stroke\`:

${scores('rime-stroke')}

\`kanjivg\`:

${scores('kanjivg')}

An induced row is a prediction, not a record. Over everything they write, the rules agree with CNS
on ${keptRate}% of the characters CNS records. The rows induced from CNS cannot be checked against the
Rime file: Rime records ${n(heldOut.length)} of those characters and ${n(heldOutAgree)} agree, since Rime's
additions do not all follow CNS order.

## Entered orders

\`entered.tsv\` holds orders entered by hand for characters and components a source does not
record, in that source's symbols. \`basis\` gives the citation or the reasoning behind each, \`by\`
who entered it. An entered order is this project's reading and never enters a source's file; it
writes its own character and lets the characters it is a component of be induced.

\`wanted.tsv\` lists, per source, the components that keep characters from being written:
\`blocks\` counts those characters and \`alone\` the ones it is the only obstacle to, most first.
To add an order, append a row to \`data/stroke-orders-entered.tsv\` in the repository and rebuild.

## Coverage

| Source | Recorded | Entered | By equivalence | From IDS | Without an order |
| --- | ---: | ---: | ---: | ---: | ---: |
${left.map(row => `| \`${row.source}\` | ${n(row.recorded)} | ${n(row.entered)} | ${n(row.equivalent)} | ${n(row.ids)} | ${n(row.none)} |`).join('\n')}

"Without an order" counts the Han characters the workshop's composer draws or either IDS source
describes that end with no row from that source. Why, for each:

| Source | No description | Unreadable description | Operator not induced through | Component without an order |
| --- | ---: | ---: | ---: | ---: |
${left.map(row => `| \`${row.source}\` | ${n(row.reasons.undescribed)} | ${n(row.reasons.unreadable)} | ${n(row.reasons.operator)} | ${n(row.reasons.component)} |`).join('\n')}

An unreadable description is a single component, carries 〾 or an operator modifier, or names a
numbered component BabelStone gives no fragment for.

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
- KanjiVG, <https://kanjivg.tagaini.net>, revision \`${KANJIVG.revision}\` of
  <https://github.com/KanjiVG/kanjivg>, Copyright (C) 2009/2010/2011 Ulrich Apel, CC BY-SA 3.0,
  <https://creativecommons.org/licenses/by-sa/3.0/>; the licence note is beside this file.
  \`kanjivg.tsv.gz\` and the rows induced from it are adapted from KanjiVG and carry the same
  licence: the kanji files reduced to their stroke types, with this project's five-class code.
- BabelStone IDS, \`IDS.TXT\`, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, public
  domain: the descriptions induced rows are written from.

- Yi Bai IDS, level 1, <https://github.com/yi-bai/ids>, MIT, Copyright (c) 2021 Yi Bai: the
  descriptions used where BabelStone has none. The licence text is beside this file.

## Rebuild

\`bun scripts/build_open_strokes.mjs\` fetches the sources and writes the files, this one included.
`)
writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2) + '\n')
for (const row of left) console.log(`${row.source}: ${row.recorded} recorded, ${row.equivalent} by equivalence, ${row.ids} from descriptions, ${row.none} without an order`)
console.log(`same order in both sources: ${agreement.sameOrder} of ${agreement.shared}`)
console.log(`induced from CNS, against Rime: ${heldOutAgree} of ${heldOut.length} (${(100 * heldOutAgree / heldOut.length).toFixed(1)}%)`)
