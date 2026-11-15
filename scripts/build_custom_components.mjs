// Build data/custom-components.json.gz: every component no code point names that BabelStone IDS,
// CHISE IDS and zi.tools write, what each is in the other tables' notation, and the descriptions
// of characters that follow. Method: scripts/lib/custom-equivalences.mjs; notation and fields:
// docs/custom-components.md.
//
//   bun scripts/build_custom_components.mjs [--check]
//
// zi.tools' table is fetched at its pinned revision and cached under cache/custom-components;
// BabelStone and CHISE are read from the bundled files.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { customKind, customsOf, isCustom, isNode, parse, write } from '../src/core/ids.js'
import { STROKE_CHAINS } from '@han-compose/composer/tree'
import { atoms, besides, createFrame, plainTree, solve, subtract } from './lib/custom-equivalences.mjs'
import { assignIds, formChar, formNumber, readLedger, writeLedger } from './lib/custom-ids.mjs'
import { formRows as tableRows } from '../demo/lib/custom-forms.js'

const CHECK = process.argv.includes('--check')
const data = name => new URL(`../data/${name}`, import.meta.url)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

const ZI = { revision: 'da1e9f8a09e2ec8faaf176bac99203f978282041', sha256: '51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18' }
async function ziTable() {
  const dir = new URL('../cache/custom-components/', import.meta.url)
  const path = new URL(`ids_lv1-${ZI.revision}.txt`, dir)
  let bytes = await readFile(path).catch(() => null)
  if (!bytes || digest(bytes) !== ZI.sha256) {
    const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${ZI.revision}/ids_lv1.txt`)
    if (!response.ok) throw new Error(`Yi Bai IDS: HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
    if (digest(bytes) !== ZI.sha256) throw new Error('Yi Bai IDS: unexpected source hash')
    await mkdir(dir, { recursive: true })
    await writeFile(path, bytes)
  }
  return bytes.toString('utf8')
}

/** The files of a ustar archive, by name. @param {Buffer} bytes @returns {Map<string, string>} */
function untar(bytes) {
  const files = new Map()
  for (let at = 0; at + 512 <= bytes.length;) {
    const name = bytes.toString('utf8', at, at + 100).replace(/\0.*$/s, '')
    if (!name) break
    const size = parseInt(bytes.toString('utf8', at + 124, at + 136).replace(/\0.*$/s, '').trim(), 8)
    files.set(name, bytes.toString('utf8', at + 512, at + 512 + size))
    at += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

// Each table: character, then its descriptions as trees, the primary one first.
const SOURCES = /** @type {const} */ (['babelstone', 'chise', 'zi-tools'])
/** @type {Record<string, Map<string, import('../src/core/ids.js').Part[]>>} */
const tables = { babelstone: new Map(), chise: new Map(), 'zi-tools': new Map() }
/** @param {string} source @param {string} char @param {string} text */
function add(source, char, text) {
  const tree = plainTree(text)
  if (tree === null) return
  const list = tables[source].get(char) ?? []
  const key = write(tree)
  if (!list.some(other => write(other) === key)) list.push(tree)
  tables[source].set(char, list)
}

const babelBytes = await readFile(data('babelstone-ids.tsv.gz'))
for (const line of gunzipSync(babelBytes).toString('utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, rest] = line.split('\t')
  if (!rest || [...char].length !== 1) continue
  for (const sequence of rest.split(' ')) {
    const match = sequence.match(/^([^()]+)\((.*)\)$/)
    if (match) add('babelstone', char, match[1])
  }
}
const chiseManifest = JSON.parse(await readFile(data('chise-sources.json'), 'utf8'))
const chiseBytes = await readFile(data('ids-corpus-sources.tar.gz'))
for (const [name, text] of untar(gunzipSync(chiseBytes))) {
  if (!name.startsWith('IDS-')) continue
  for (const line of text.split('\n')) {
    const fields = line.split('\t')
    if (fields.length < 3 || !/^U[+-][0-9A-F]+$/i.test(fields[0]) || [...fields[1]].length !== 1) continue
    add('chise', fields[1], fields[2])
  }
}
for (const row of (await ziTable()).split('\n')) {
  const [char, ...columns] = row.split('\t')
  if (!char || [...char].length !== 1) continue
  for (const column of columns) for (const part of column.split(';')) if (part.trim()) add('zi-tools', char, part.trim())
}

const frames = Object.fromEntries(SOURCES.map(source => [source, createFrame(tables[source])]))
const SOURCE_OF = { numbered: 'babelstone', entity: 'chise', chain: 'zi-tools' }

// The dictionary: every custom component, how often it is used and where.
/** @type {Map<string, { chars: Set<string> }>} */
const used = new Map()
for (const source of SOURCES) for (const [char, trees] of tables[source]) for (const tree of trees) {
  for (const custom of customsOf(tree)) {
    if (SOURCE_OF[/** @type {'numbered'} */ (customKind(custom))] !== source) continue
    const entry = used.get(custom) ?? { chars: new Set() }
    used.set(custom, entry)
    entry.chars.add(char)
  }
}
/** BabelStone's note 6: where each number occurs, and the fragment that writes it out. */
const numbered = new Map()
for (const line of (await readFile(data('ids-components.tsv'), 'utf8')).split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const [name, description, fragment] = line.split('\t')
  numbered.set(name, { description, fragment: fragment || null })
}
for (const name of numbered.keys()) if (!used.has(name)) used.set(name, { chars: new Set() })

// Each component in each other table's parts.
/** @type {Map<string, { in: string, text: string, count: number, characters: string[], status: string, basis: 'difference' | 'inverse', id?: string, arrangements?: { text: string, count: number, id?: string }[] }[]>} */
const equivalents = new Map()
/** @type {Record<string, Record<string, Map<string, import('../src/core/ids.js').Part>>>} */
const solved = {}
/** Component and frame, where the expression standing for the component there is confirmed. @type {Set<string>} */
const firm = new Set()
for (const from of SOURCES) for (const frame of SOURCES) {
  if (from === frame) continue
  const found = solve(tables[from], frames[frame])
  const best = (solved[from] ??= {})[frame] = new Map()
  for (const [custom, rows] of found) {
    // Two spellings with the same parts are one shape bracketed two ways: the commoner stands, and
    // the shape is confirmed only where one spelling is given by two characters or more.
    /** @type {Map<string, { text: string, top: number, chars: string[], spellings: Map<string, number> }>} */
    const shapes = new Map()
    for (const [text, chars] of rows) {
      const tree = /** @type {import('../src/core/ids.js').Part} */ (plainTree(text))
      const key = atoms(tree).sort().join('\0')
      const shape = shapes.get(key)
      if (!shape) shapes.set(key, { text, top: chars.length, chars: [...chars], spellings: new Map([[text, chars.length]]) })
      else {
        shape.spellings.set(text, chars.length)
        if (chars.length > shape.top) { shape.text = text; shape.top = chars.length }
        shape.chars.push(...chars.filter(char => !shape.chars.includes(char)))
      }
    }
    const ordered = [...shapes.values()].sort((a, b) => b.chars.length - a.chars.length || a.text.length - b.text.length || (a.text < b.text ? -1 : 1))
    const list = equivalents.get(custom) ?? []
    equivalents.set(custom, list)
    /** @param {string} text */
    const folded = text => write(frames[frame].collapse(plainTree(text)))
    for (const shape of ordered) list.push({
      in: frame, text: folded(shape.text), count: shape.chars.length,
      characters: shape.chars.slice(0, 12), status: shape.top >= 2 ? 'verified' : 'candidate', basis: 'difference',
      // The same parts arranged another way: a different form until someone says otherwise.
      ...(shape.spellings.size > 1 ? { arrangements: [...shape.spellings].filter(([text]) => text !== shape.text)
        .map(([text, count]) => ({ text: folded(text), count })).filter(other => other.text !== folded(shape.text))
        .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1)) } : {}),
    })
    best.set(custom, /** @type {import('../src/core/ids.js').Part} */ (plainTree(ordered[0].text)))
    // What a derived description rests on is this first expression, so its standing is that one's.
    if (ordered[0].top >= 2) firm.add(`${custom}\0${frame}`)
  }
}

// The other way round: where a component is another table's component beside further parts, that
// one is this one less those parts ({53} is ⿱丿⿴#(-𠃌㇉)丶, so #(-𠃌㇉) is ㇯㇯{53}丿丶).
for (const [custom, list] of [...equivalents]) for (const row of list.filter(row => row.basis === 'difference')) {
  const tree = /** @type {import('../src/core/ids.js').Part} */ (plainTree(row.text))
  const inner = customsOf(tree)
  if (!isNode(tree) || inner.length !== 1 || SOURCE_OF[/** @type {'numbered'} */ (customKind(inner[0]))] !== row.in) continue
  const others = besides(tree, inner[0])
  const text = others.reduce((/** @type {string} */ text, part) => `㇯${text}${write(part)}`, custom)
  const back = equivalents.get(inner[0]) ?? []
  equivalents.set(inner[0], back)
  const into = SOURCE_OF[/** @type {'numbered'} */ (customKind(custom))]
  if (!back.some(other => other.in === into && other.text === text)) back.push({ in: into, text, count: row.count, characters: row.characters, status: row.status, basis: 'inverse' })
}

// A stroke chain the grammar gives a character is that character.
const CHAIN_NAMES = Object.entries(STROKE_CHAINS).map(([chain, char]) => ({ chain: `#(${chain})`, char }))

const components = [...used].map(([text, entry]) => {
  const kind = /** @type {'numbered'} */ (customKind(text))
  const chars = [...entry.chars]
  const note = numbered.get(text)
  // The same component as what is left of a character once its other parts are taken out: {51} is
  // 馬 without 灬, ㇯馬灬. Up to two parts are taken, each a character that stands once.
  /** @type {string[]} */
  const subtractions = []
  for (const char of chars) for (const tree of tables[SOURCE_OF[kind]].get(char) ?? []) {
    if (!isNode(tree) || atoms(tree).filter(atom => atom === text).length !== 1) continue
    const others = besides(tree, text)
    if (!others.length || others.length > 2) continue
    if (!others.every(other => typeof other === 'string' && !isCustom(other) && [...other].length === 1 && atoms(tree).filter(atom => atom === other).length === 1)) continue
    const written = others.reduce((/** @type {string} */ whole, other) => `㇯${whole}${other}`, char)
    if (!subtractions.includes(written)) subtractions.push(written)
  }
  return {
    text, kind, source: SOURCE_OF[kind],
    ...(note ? { description: note.description, ...(note.fragment ? { fragment: note.fragment } : {}) } : {}),
    uses: chars.length, examples: chars.slice(0, 8), usedIn: chars.join(''),
    ...(subtractions.length ? { subtractions } : {}),
    equivalents: equivalents.get(text) ?? [],
  }
}).sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) || b.uses - a.uses || (a.text < b.text ? -1 : 1))

// What draws each component: BabelStone's fragment or the private-use glyph of its font, else the
// first equivalent that names characters only, confirmed ones first and subtractions last.
const palette = JSON.parse(await readFile(data('ids-parts.json'), 'utf8'))
const glyphAt = palette.columns.indexOf('glyph')
const glyphs = new Map(palette.parts.filter(row => row[glyphAt]).map(row => [row[0], row[glyphAt]]))
/** @type {Map<string, string | null>} */
const draws = new Map()
const rowOf = new Map(components.map(row => [row.text, row]))
/** @param {typeof components[number]} row What may draw a component, the best first. */
const candidatesOf = row => [
  ...(row.fragment ? [row.fragment] : []), ...(glyphs.has(row.text) ? [glyphs.get(row.text)] : []),
  ...[...row.equivalents].sort((a, b) => Number(a.basis === 'inverse') - Number(b.basis === 'inverse')
    || Number(b.status === 'verified') - Number(a.status === 'verified') || b.count - a.count).map(item => item.text),
]
/**
 * What draws one component: its best candidate every custom component of which draws in turn. Two
 * components may each be the other less a part, so a candidate that leads back to a component
 * still being worked out is passed over.
 * @param {string} text @param {Set<string>} open @returns {string | null}
 */
function drawOf(text, open) {
  if (draws.has(text)) return draws.get(text) ?? null
  const row = rowOf.get(text)
  if (!row || open.has(text)) return null
  const inside = new Set(open).add(text)
  let found = null
  for (const candidate of candidatesOf(row)) {
    const tree = plainTree(candidate)
    if (tree === null) continue
    let whole = true
    /** @param {import('../src/core/ids.js').Part} part @returns {import('../src/core/ids.js').Part} */
    const swap = part => {
      if (isNode(part)) return { op: part.op, parts: part.parts.map(swap) }
      if (part === null || !isCustom(part)) return part
      const draw = drawOf(part, inside)
      if (draw === null) { whole = false; return part }
      return plainTree(draw)
    }
    const out = write(swap(tree))
    if (whole && [...out].length <= 64) { found = out; break }
  }
  // An answer reached while another component was open may have passed a candidate over for that
  // reason alone, so only an answer worked out from the top is kept.
  if (!open.size || found !== null) draws.set(text, found)
  return found
}
for (const row of components) {
  const draw = drawOf(row.text, new Set())
  if (draw !== null) Object.assign(row, { draw })
}
const drawable = components.filter(row => 'draw' in row).length
// Identity. A form is one thing drawn one way. Every custom component is a form, and so is every
// expression found for one that no source names. Two names are one form only where the tables
// confirm it: one is the other on two or more characters, or both are the same confirmed
// expression. A source's own two names are never one form: the source tells them apart.
const SOURCE_RANK = /** @type {Record<string, number>} */ ({ babelstone: 0, chise: 1, 'zi-tools': 2 })
/** @param {string} a @param {string} b The order names are numbered in: BabelStone's by number, then entities, then chains. */
const byName = (a, b) => {
  const ka = /** @type {'numbered'} */ (customKind(a)), kb = /** @type {'numbered'} */ (customKind(b))
  return SOURCE_RANK[SOURCE_OF[ka]] - SOURCE_RANK[SOURCE_OF[kb]] || (ka === 'numbered' ? Number(a.slice(1, -1)) - Number(b.slice(1, -1)) : 0) || (a < b ? -1 : a > b ? 1 : 0)
}
const names = components.map(row => row.text).sort(byName)
/** @type {Map<string, string>} */
const leader = new Map(names.map(name => [name, name]))
/** @param {string} name @returns {string} */
const find = name => { let at = name; while (leader.get(at) !== at) at = /** @type {string} */ (leader.get(at)); leader.set(name, at); return at }
/** @type {Map<string, Set<string>>} */
const sourcesOf = new Map(names.map(name => [name, new Set([SOURCE_OF[/** @type {'numbered'} */ (customKind(name))]])]))
/** @type {{ a: string, b: string, count: number }[]} */
const same = []
/** @type {Map<string, { name: string, count: number }[]>} */
const spelled = new Map()
for (const row of components) for (const item of row.equivalents) {
  if (item.basis !== 'difference' || item.status !== 'verified') continue
  if (isCustom(item.text)) { if (leader.has(item.text)) same.push({ a: row.text, b: item.text, count: item.count }) }
  else if (isNode(plainTree(item.text))) spelled.set(item.text, [...(spelled.get(item.text) ?? []), { name: row.text, count: item.count }])
}
for (const users of spelled.values()) for (const other of users.slice(1)) same.push({ a: users[0].name, b: other.name, count: Math.min(users[0].count, other.count) })
same.sort((x, y) => y.count - x.count || byName(x.a, y.a) || byName(x.b, y.b))
for (const { a, b } of same) {
  const [one, two] = [find(a), find(b)].sort(byName)
  if (one === two) continue
  const mine = /** @type {Set<string>} */ (sourcesOf.get(one)), theirs = /** @type {Set<string>} */ (sourcesOf.get(two))
  if ([...theirs].some(source => mine.has(source))) continue
  leader.set(two, one)
  for (const source of theirs) mine.add(source)
}
/** @type {Map<string, string[]>} */
const members = new Map()
for (const name of names) members.set(find(name), [...(members.get(find(name)) ?? []), name])
// A confirmed expression is another name of its form, where one form alone has it.
/** @type {Map<string, string>} */
const spellingOf = new Map()
for (const [text, users] of spelled) {
  const forms = new Set(users.map(user => find(user.name)))
  if (forms.size === 1) spellingOf.set(text, [...forms][0])
}
/** @type {{ first: string, aliases: string[] }[]} */
const forms = [...members].map(([first, list]) => ({ first, aliases: [...list, ...[...spellingOf].filter(([, form]) => form === first).map(([text]) => text).sort()] }))
// An expression nothing confirms, or the same parts arranged another way, is a form of its own.
const unnamed = new Set()
for (const row of components) for (const item of row.equivalents) {
  if (item.basis !== 'difference') continue
  for (const text of [...(item.status === 'verified' ? [] : [item.text]), ...(item.arrangements ?? []).map(other => other.text)]) {
    if (!isCustom(text) && isNode(plainTree(text)) && !spellingOf.has(text)) unnamed.add(text)
  }
}
for (const text of [...unnamed].sort()) forms.push({ first: text, aliases: [text] })

const ledgerUrl = data('custom-ids.tsv')
const priorLedger = readLedger(await readFile(ledgerUrl, 'utf8').catch(() => ''))
const ledger = assignIds(forms, priorLedger, new Date().toISOString().slice(0, 10))
/** @param {string} text @returns {string | undefined} The form a name or an expression is. */
const idOf = text => ledger.idOf.get(text)
for (const row of components) {
  Object.assign(row, { id: idOf(row.text), char: formChar(/** @type {string} */ (idOf(row.text))) })
  for (const item of row.equivalents) {
    const id = item.basis === 'difference' ? idOf(item.text) : undefined
    if (id) item.id = id
    for (const other of item.arrangements ?? []) { const own = idOf(other.text); if (own) other.id = own }
  }
}
// A subtraction two forms both claim (a character one table writes two ways) names neither.
/** @type {Map<string, Set<string>>} */
const claimed = new Map()
for (const row of components) for (const written of /** @type {{ subtractions?: string[] }} */ (row).subtractions ?? []) claimed.set(written, (claimed.get(written) ?? new Set()).add(/** @type {string} */ (idOf(row.text))))
for (const row of /** @type {{ subtractions?: string[] }[]} */ (components)) {
  if (!row.subtractions) continue
  row.subtractions = row.subtractions.filter(written => claimed.get(written)?.size === 1)
  if (!row.subtractions.length) delete row.subtractions
}
const formRows = forms.map(form => ({ id: /** @type {string} */ (idOf(form.first)), char: formChar(/** @type {string} */ (idOf(form.first))), names: form.aliases }))
  .sort((a, b) => formNumber(a.id) - formNumber(b.id))
const retiredRows = ledger.rows.filter(row => row.note.startsWith('merged into') || row.note === 'withdrawn').map(row => ({ id: row.id, note: row.note }))

// Characters: a description that names a custom component, said in another table's notation.
/** @type {{ char: string, text: string, in: string, from: string, basis: 'substitution' | 'subtraction', of: string, status: string }[]} */
const characters = []
const seenRow = new Set()
/** @param {typeof characters[number]} row */
/** @type {Record<string, Map<string, Set<string>>>} Each table's descriptions of a character, with characters written whole. */
const written = {}
/** @param {string} source @param {string} char @param {string} text */
const attestedIn = (source, char, text) => {
  const table = written[source] ??= new Map()
  let texts = table.get(char)
  if (!texts) table.set(char, texts = new Set((tables[source].get(char) ?? []).flatMap(tree => [write(tree), write(frames[source].collapse(tree))])))
  return texts.has(text)
}
const emit = row => {
  // The forms the description names, by identifier.
  // Both sides count: the description, and for a substitution the one it was made from.
  const ids = [...new Set([...customsOf(plainTree(row.text)), ...(row.basis === 'substitution' ? customsOf(plainTree(row.of)) : [])].map(idOf).filter(Boolean))]
  if (ids.length) Object.assign(row, { ids })
  const key = `${row.char}\0${row.in}\0${row.text}`
  // Only a whole description is a row: written out, a long one may pass what a description holds.
  if (seenRow.has(key) || parse(row.text).problem) return
  seenRow.add(key)
  // Whether the table the description is written for writes it itself: such a row is that table's
  // own description, reached here from the other side.
  if (attestedIn(row.in, row.char, row.text)) Object.assign(row, { attested: true })
  characters.push(row)
}
const verified = firm

for (const from of SOURCES) for (const into of SOURCES) {
  if (from === into) continue
  const best = solved[from][into]
  // Substitution: each custom component replaced by what it is in the other table.
  for (const [char, trees] of tables[from]) for (const tree of trees) {
    const customs = customsOf(tree)
    if (!customs.length || !customs.every(custom => best.has(custom))) continue
    /** @param {import('../src/core/ids.js').Part} part @returns {import('../src/core/ids.js').Part} */
    const swap = part => isNode(part) ? { op: part.op, parts: part.parts.map(swap) } : best.get(/** @type {string} */ (part)) ?? part
    const text = write(frames[into].collapse(swap(tree)))
    if ([...text].length === 1) continue
    emit({ char, text, in: into, from, basis: 'substitution', of: write(tree),
      status: customs.every(custom => verified.has(`${custom}\0${into}`)) ? 'verified' : 'candidate' })
  }
  // Subtraction: `into` describes a character as this one beside other parts, and `from` writes
  // that character with a custom component; this one is that description less the other parts.
  const whole = frames[into]
  /** @param {string} part */
  const holds = part => atoms(whole.expand(best.get(part) ?? part))
  for (const [outer, described] of tables[into]) {
    const customTrees = (tables[from].get(outer) ?? []).filter(tree => customsOf(tree).length && customsOf(tree).every(custom => best.has(custom)))
    if (!customTrees.length) continue
    const [first] = described
    if (!isNode(first)) continue
    for (const inner of first.parts) {
      if (typeof inner !== 'string' || isCustom(inner) || inner === outer || !tables[into].has(inner)) continue
      // Where the character stands twice, which one is left is not known.
      if (atoms(first).filter(atom => atom === inner).length !== 1) continue
      const others = besides(first, inner)
      const gone = others.flatMap(part => atoms(whole.expand(part)))
      for (const tree of customTrees) {
        let failed = false
        const named = /** @param {string[]} mine */ mine => {
          const key = [...mine].sort().join('\0')
          const part = others.find(other => atoms(whole.expand(other)).sort().join('\0') === key)
          if (part !== undefined) return part
          if (mine.length === 1) return mine[0]
          failed = true
          return null
        }
        const rest = subtract(tree, gone, holds, named)
        // A result that still names the character says it in terms of itself.
        if (rest === null || failed || !customsOf(rest).length || atoms(rest).some(atom => atom === inner || atom.includes(inner))) continue
        emit({ char: inner, text: write(rest), in: from, from: into, basis: 'subtraction', of: `㇯${outer}${others.map(write).join('')}`,
          status: customsOf(tree).every(custom => verified.has(`${custom}\0${into}`)) ? 'verified' : 'candidate' })
      }
    }
  }
}
characters.sort((a, b) => /** @type {number} */ (a.char.codePointAt(0)) - /** @type {number} */ (b.char.codePointAt(0))
  || SOURCES.indexOf(/** @type {'chise'} */ (a.in)) - SOURCES.indexOf(/** @type {'chise'} */ (b.in)) || (a.text < b.text ? -1 : 1))

// The stroke letters a chain is written with.
const strokeLetters = JSON.parse(await readFile(new URL('./data/stroke-letters.json', import.meta.url), 'utf8'))

const document = {
  format: 'ids-input/custom-components', version: 1,
  licence: 'GPL-2.0-or-later',
  sources: [
    { id: 'babelstone', title: 'BabelStone IDS', author: 'Andrew West (魏安)', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT', edition: '2025-06-27', licence: 'Public Domain', sha256: digest(babelBytes), file: 'data/babelstone-ids.tsv.gz' },
    { id: 'chise', title: 'CHISE IDS', author: 'MORIOKA Tomohiko and contributors', url: 'https://gitlab.chise.org/CHISE/ids', edition: chiseManifest.files[0]?.edition ?? '', licence: 'GPL-2.0-or-later', sha256: digest(chiseBytes), file: 'data/ids-corpus-sources.tar.gz' },
    { id: 'zi-tools', title: 'Yi Bai IDS, ids_lv1.txt', author: 'Yi Bai (白易)', url: `https://github.com/yi-bai/ids/blob/${ZI.revision}/ids_lv1.txt`, edition: ZI.revision, licence: 'MIT', sha256: ZI.sha256 },
    ...strokeLetters.sources,
  ],
  counts: {
    components: components.length,
    bySource: Object.fromEntries(SOURCES.map(source => [source, components.filter(row => row.source === source).length])),
    withEquivalent: components.filter(row => row.equivalents.length).length,
    verified: components.filter(row => row.equivalents.some(item => item.status === 'verified')).length,
    drawable,
    characters: characters.length,
    forms: formRows.length,
  },
  forms: formRows,
  retired: retiredRows,
  strokeLetters: strokeLetters.strokes,
  chainNames: CHAIN_NAMES,
  components,
  characters,
}
// The same table flat, one row per form, for a spreadsheet or a script: JSON, TSV and CSV.
const flat = tableRows(/** @type {any} */ (document)).map(row => {
  /** @param {string} source */
  const named = source => row.names.filter(name => name.source === source).map(name => name.text).join(' ')
  return {
    id: row.id, entity: `&${row.id};`, char: `U+${(0xf0000 + row.number).toString(16).toUpperCase()}`,
    babelstone: named('babelstone'), chise: named('chise'), zi_tools: named('zi-tools'), expression: named('unnamed'),
    subtractions: row.subtractions.join(' '),
    description: row.names.map(name => name.description ?? '').filter(Boolean).join('; '),
    status: row.status, uses: row.uses, used_in: row.usedIn,
    equivalents: row.equivalents.map(item => ({ in: item.in, text: item.text, status: item.status, count: item.count, ...(item.id ? { id: item.id } : {}) })),
    of: row.of,
  }
})
const COLUMNS = /** @type {const} */ (['id', 'entity', 'char', 'babelstone', 'chise', 'zi_tools', 'expression', 'subtractions', 'description', 'status', 'uses', 'used_in', 'equivalents', 'of'])
/** @param {typeof flat[number]} row @returns {string[]} */
const cells = row => COLUMNS.map(column => column === 'equivalents' ? row.equivalents.map(item => `${item.in}:${item.text}:${item.status}:${item.count}`).join(' | ')
  : column === 'of' ? row.of.map(other => `${other.relation}:${other.id}`).join(' | ') : String(row[column]))
const NOTICE = 'Forms no code point names in BabelStone IDS, CHISE IDS and zi.tools; derived by ids-input (https://ids.mkpo.li/unencoded); GPL-2.0-or-later.'
const flatFiles = {
  'custom-forms.json': JSON.stringify({ format: 'ids-input/custom-forms', version: 1, licence: 'GPL-2.0-or-later', notice: NOTICE, sources: document.sources, columns: COLUMNS, rows: flat }, null, 1) + '\n',
  'custom-forms.tsv': [`# ${NOTICE}`, COLUMNS.join('\t'), ...flat.map(row => cells(row).map(cell => cell.replace(/[\t\n]/g, ' ')).join('\t'))].join('\n') + '\n',
  'custom-forms.csv': [COLUMNS.join(','), ...flat.map(row => cells(row).map(cell => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(','))].join('\r\n') + '\r\n',
}

const bytes = gzipSync(JSON.stringify(document), { level: 9 })
const out = data('custom-components.json.gz')
const ledgerText = writeLedger(ledger.rows)
if (CHECK) {
  const current = await readFile(out).catch(() => null)
  const flatStale = (await Promise.all(Object.entries(flatFiles).map(async ([name, text]) => text !== await readFile(data(name), 'utf8').catch(() => '')))).some(Boolean)
  if (!current || !gunzipSync(current).equals(gunzipSync(bytes)) || flatStale || ledgerText !== await readFile(ledgerUrl, 'utf8').catch(() => '')) { console.error('data/custom-components.json.gz is stale: run bun scripts/build_custom_components.mjs'); process.exit(1) }
} else {
  await writeFile(out, bytes); await writeFile(ledgerUrl, ledgerText)
  for (const [name, text] of Object.entries(flatFiles)) await writeFile(data(name), text)
}
console.log(JSON.stringify(document.counts), `${bytes.length} bytes`)
