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
/** @type {Map<string, { in: string, text: string, count: number, characters: string[], status: string, basis: 'difference' | 'inverse' }[]>} */
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
    /** @type {Map<string, { text: string, top: number, chars: string[] }>} */
    const shapes = new Map()
    for (const [text, chars] of rows) {
      const tree = /** @type {import('../src/core/ids.js').Part} */ (plainTree(text))
      const key = atoms(tree).sort().join('\0')
      const shape = shapes.get(key)
      if (!shape) shapes.set(key, { text, top: chars.length, chars: [...chars] })
      else {
        if (chars.length > shape.top) { shape.text = text; shape.top = chars.length }
        shape.chars.push(...chars.filter(char => !shape.chars.includes(char)))
      }
    }
    const ordered = [...shapes.values()].sort((a, b) => b.chars.length - a.chars.length || a.text.length - b.text.length || (a.text < b.text ? -1 : 1))
    const list = equivalents.get(custom) ?? []
    equivalents.set(custom, list)
    for (const shape of ordered) list.push({
      in: frame, text: write(frames[frame].collapse(plainTree(shape.text))), count: shape.chars.length,
      characters: shape.chars.slice(0, 12), status: shape.top >= 2 ? 'verified' : 'candidate', basis: 'difference',
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
  // The same component as what is left of a character it stands in beside one other part.
  let subtraction = null
  for (const char of chars) {
    const tree = tables[SOURCE_OF[kind]].get(char)?.find(tree => isNode(tree) && tree.parts.length === 2 && tree.parts.includes(text))
    if (!isNode(tree)) continue
    const other = tree.parts.find(part => part !== text)
    if (typeof other !== 'string' || isCustom(other)) continue
    subtraction = `㇯${char}${other}`
    break
  }
  return {
    text, kind, source: SOURCE_OF[kind],
    ...(note ? { description: note.description, ...(note.fragment ? { fragment: note.fragment } : {}) } : {}),
    uses: chars.length, examples: chars.slice(0, 8),
    ...(subtraction ? { subtraction } : {}),
    equivalents: equivalents.get(text) ?? [],
  }
}).sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) || b.uses - a.uses || (a.text < b.text ? -1 : 1))

// Characters: a description that names a custom component, said in another table's notation.
/** @type {{ char: string, text: string, in: string, from: string, basis: 'substitution' | 'subtraction', of: string, status: string }[]} */
const characters = []
const seenRow = new Set()
/** @param {typeof characters[number]} row */
const emit = row => {
  const key = `${row.char}\0${row.in}\0${row.text}`
  // Only a whole description is a row: written out, a long one may pass what a description holds.
  if (seenRow.has(key) || parse(row.text).problem) return
  seenRow.add(key)
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
    characters: characters.length,
  },
  strokeLetters: strokeLetters.strokes,
  chainNames: CHAIN_NAMES,
  components,
  characters,
}
const bytes = gzipSync(JSON.stringify(document), { level: 9 })
const out = data('custom-components.json.gz')
if (CHECK) {
  const current = await readFile(out).catch(() => null)
  if (!current || !gunzipSync(current).equals(gunzipSync(bytes))) { console.error('data/custom-components.json.gz is stale: run bun scripts/build_custom_components.mjs'); process.exit(1) }
} else await writeFile(out, bytes)
console.log(JSON.stringify(document.counts), `${bytes.length} bytes`)
