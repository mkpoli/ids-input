// Count the layouts explicitly supplied by the bundled IDS sources. Encoded components stay intact.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { parse, write } from '../src/core/ids.js'
import { parseIdsTable, mergeIdsTables } from '../src/adapter/babelstone.js'

export const MIN_CHARACTERS = 50
const RETAINED = [
  ['pairRow', '⿰⬚⬚'], ['pairColumn', '⿱⬚⬚'], ['tripleRow', '⿲⬚⬚⬚'], ['tripleColumn', '⿳⬚⬚⬚'],
  ['pyramid', '⿱⬚⿰⬚⬚'], ['invertedPyramid', '⿱⿰⬚⬚⬚'], ['leftPair', '⿰⿱⬚⬚⬚'], ['rightPair', '⿰⬚⿱⬚⬚'],
  ['grid', '⿱⿰⬚⬚⿰⬚⬚'], ['fourRow', '⿰⿰⬚⬚⿰⬚⬚'], ['fourColumn', '⿱⿱⬚⬚⿱⬚⬚'],
  ['topTriple', '⿱⿲⬚⬚⬚⬚'], ['bottomTriple', '⿱⬚⿲⬚⬚⬚'], ['leftTriple', '⿰⿳⬚⬚⬚⬚'], ['rightTriple', '⿰⬚⿳⬚⬚⬚'],
  ['middleColumn', '⿲⬚⿱⬚⬚⬚'], ['middleRow', '⿳⬚⿰⬚⬚⬚'],
]
// Useful Hangul layout requested independently of the Han-only corpus audit.
const CURATED = [['hangulFinal', '⿱⿽⬚⬚⬚']]
const EXCLUDED_OPERATORS = new Set(['〾', '⿾', '⿿', '㇯'])
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const isLeaf = tree => tree === null || typeof tree === 'string'
const countLeaves = tree => isLeaf(tree) ? 1 : tree.parts.reduce((total, part) => total + countLeaves(part), 0)
const hasUnknown = tree => isLeaf(tree) ? tree === null || tree === '？' : tree.parts.some(hasUnknown)
const skeleton = tree => isLeaf(tree) ? null : { op: tree.op, parts: tree.parts.map(skeleton) }
const operators = tree => isLeaf(tree) ? [] : [tree.op, ...tree.parts.flatMap(operators)]
const axis = op => op === '⿰' || op === '⿲' ? 'H' : op === '⿱' || op === '⿳' ? 'V' : null
const isHan = char => {
  const cp = char.codePointAt(0)
  return cp >= 0x3400 && cp <= 0x4dbf || cp >= 0x4e00 && cp <= 0x9fff || cp >= 0xf900 && cp <= 0xfaff || cp >= 0x20000 && cp <= 0x3ffff
}

/** Normalize structural association, not the relative proportions of rendered parts. */
export function normalizeStructure(tree) {
  if (isLeaf(tree)) return '_'
  const direction = axis(tree.op), children = []
  const add = child => {
    if (direction && !isLeaf(child) && axis(child.op) === direction) child.parts.forEach(add)
    else children.push(normalizeStructure(child))
  }
  tree.parts.forEach(add)
  if (direction === 'H' && children.join('') === 'V(_,_)V(_,_)'
    || direction === 'V' && children.join('') === 'H(_,_)H(_,_)') return 'GRID2x2'
  return `${direction ?? tree.op}(${children.join(',')})`
}

/** One character counts once per normalized skeleton, across all its alternative descriptions. */
export function auditStructures(table) {
  const patterns = new Map(), eligible = new Set()
  const totals = { mergedCharacters: table.size, hanCharacters: 0, descriptions: 0, validDescriptions: 0,
    invalidDescriptions: 0, unknownDescriptions: 0, eligibleDescriptions: 0 }
  for (const [char, descriptions] of table) {
    if (!isHan(char)) continue
    totals.hanCharacters++
    for (const { text } of descriptions) {
      totals.descriptions++
      const parsed = parse(text)
      if (parsed.problem) { totals.invalidDescriptions++; continue }
      totals.validDescriptions++
      if (hasUnknown(parsed.tree)) { totals.unknownDescriptions++; continue }
      const slots = countLeaves(parsed.tree)
      if (slots < 2 || slots > 4) continue
      totals.eligibleDescriptions++; eligible.add(char)
      const tree = skeleton(parsed.tree), sequence = write(tree), key = normalizeStructure(tree)
      let pattern = patterns.get(key)
      if (!pattern) patterns.set(key, pattern = { key, slots, operators: operators(tree), characters: new Set(), spellings: new Map(), examples: new Map() })
      pattern.characters.add(char)
      if (!pattern.examples.has(char)) pattern.examples.set(char, text)
      if (!pattern.spellings.has(sequence)) pattern.spellings.set(sequence, new Set())
      pattern.spellings.get(sequence).add(char)
    }
  }
  return { patterns, totals: { ...totals, eligibleCharacters: eligible.size } }
}

export function buildCatalog(table, sources, threshold = MIN_CHARACTERS) {
  const { patterns, totals } = auditStructures(table)
  const retained = new Map(RETAINED.map(([id, sequence]) => [normalizeStructure(parse(sequence, { open: true }).tree), { id, sequence }]))
  const curated = new Map(CURATED.map(([id, sequence]) => [normalizeStructure(parse(sequence, { open: true }).tree), { id, sequence, curated: true }]))
  const selected = new Map([...retained, ...curated]), previousCoverage = new Set(), coverage = new Set()
  for (const pattern of patterns.values()) {
    if (retained.has(pattern.key)) for (const char of pattern.characters) previousCoverage.add(char)
    if (pattern.characters.size < threshold || pattern.operators.some(op => EXCLUDED_OPERATORS.has(op)) || selected.has(pattern.key)) continue
    const sequence = [...pattern.spellings].sort(([a, ac], [b, bc]) => bc.size - ac.size || compare(a, b))[0][0]
    // The normalized key keeps the ID stable if another source spelling becomes more frequent.
    selected.set(pattern.key, { id: `layout-${digest(pattern.key).slice(0, 12)}`, sequence })
  }
  const templates = [...selected].map(([key, template]) => {
    const pattern = patterns.get(key)
    for (const char of pattern?.characters ?? []) coverage.add(char)
    return { ...template, curated: template.curated ?? false, slots: countLeaves(parse(template.sequence, { open: true }).tree), count: pattern?.characters.size ?? 0,
      examples: [...pattern?.examples.keys() ?? []].slice(0, 5) }
  }).sort((a, b) => a.slots - b.slots || b.count - a.count || compare(a.id, b.id))
  return {
    version: 1,
    threshold,
    method: 'Unique Han characters per supplied whole-character IDS skeleton with two to four leaves; no lexical expansion. Same-axis nesting and both 2x2 grid orientations are normalized. Alternative descriptions may match multiple templates. Unary transforms and subtraction are excluded from additions. Curated layouts are retained independently of the Han-only frequency threshold. Counts describe corpus decompositions, not language-use frequency.',
    sources,
    statistics: { ...totals, previousTemplates: retained.size, previousCoveredCharacters: previousCoverage.size,
      curatedTemplates: curated.size, frequencyAdditions: templates.length - retained.size - curated.size,
      templates: templates.length, addedTemplates: templates.length - retained.size, coveredCharacters: coverage.size },
    templates,
  }
}

export function readBundledSources() {
  const records = [
    { id: 'babelstone', path: 'data/babelstone-ids.tsv.gz', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT' },
    { id: 'yi-bai', path: 'data/yi-bai-ids.tsv.gz', url: 'https://github.com/yi-bai/ids/blob/da1e9f8a09e2ec8faaf176bac99203f978282041/ids_lv1.txt' },
  ].map(source => {
    const compressed = readFileSync(new URL(`../${source.path}`, import.meta.url)), bytes = gunzipSync(compressed), text = bytes.toString('utf8')
    const version = source.id === 'babelstone' ? text.match(/File Date ([\d-]+)/)?.[1] : text.match(/level 1, ([a-f0-9]{40})/)?.[1]
    if (!version) throw new Error(`Missing version in ${source.path}`)
    return { table: parseIdsTable(text), metadata: { ...source, version, compressedSha256: digest(compressed), textSha256: digest(bytes),
      header: text.split('\n').filter(line => line.startsWith('#')) } }
  })
  return { table: mergeIdsTables(records[0].table, records[1].table), sources: records.map(record => record.metadata) }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { table, sources } = readBundledSources()
  const catalog = buildCatalog(table, sources)
  const target = new URL('../src/core/structure-templates.json', import.meta.url)
  writeFileSync(target, JSON.stringify(catalog, null, 2) + '\n')
  console.log(`${catalog.templates.length} templates; ${catalog.statistics.coveredCharacters}/${catalog.statistics.eligibleCharacters} eligible characters`)
}
