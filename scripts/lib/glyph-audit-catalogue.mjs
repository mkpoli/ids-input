import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseIdsTable } from '../../src/adapter/babelstone.js'
import { isNode, parse } from '../../src/core/ids.js'
import { EXAMPLE_GROUPS } from '../../demo/lib/examples.js'
import { EXAMPLE_SOURCES } from '../../demo/lib/example-sources.js'

const ENCLOSURES = new Set(['⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿼', '⿽'])
const TABLES = [
  ['babelstone', 'data/babelstone-ids.tsv.gz'],
  ['yi-bai', 'data/yi-bai-ids.tsv.gz'],
]

/** Structural density counts leaf components, not strokes or Unicode code points.
 * Operators anywhere in the parsed tree contribute to the overlay/enclosure flags. */
export function glyphAuditMetrics(tree) {
  if (!isNode(tree)) return { leaves: tree === null ? 0 : 1, operators: 0, depth: 0, overlay: false, enclosure: false }
  const children = tree.parts.map(glyphAuditMetrics)
  return {
    leaves: children.reduce((sum, child) => sum + child.leaves, 0),
    operators: 1 + children.reduce((sum, child) => sum + child.operators, 0),
    depth: 1 + Math.max(0, ...children.map(child => child.depth)),
    overlay: tree.op === '⿻' || children.some(child => child.overlay),
    enclosure: ENCLOSURES.has(tree.op) || children.some(child => child.enclosure),
  }
}

/** Read the shipped tables and examples without expansion or cross-source deduplication.
 * Paths resolve from this module, independently of the caller's working directory.
 * `entries` hold parseable descriptions; `rejected` retain attribution and parser problems.
 * Demo citation numbers inherit from their group, including explicit empty overrides.
 * Table header comments carry the bundled source/version attribution verbatim. */
export async function loadGlyphAuditCatalogue() {
  const records = []
  for (const [source, path] of TABLES) {
    const text = gunzipSync(await readFile(new URL(`../../${path}`, import.meta.url))).toString('utf8')
    const headers = text.split('\n').filter(line => line.startsWith('#'))
    for (const [char, descriptions] of parseIdsTable(text)) {
      for (const { text: sequence, regions } of descriptions) {
        records.push({ source, path, headers, char, sequence, regions })
      }
    }
  }
  for (const group of EXAMPLE_GROUPS) {
    for (const example of group.examples) {
      const refs = [...(example.refs ?? group.refs ?? [])]
      records.push({ ...example, ...(example.source ? { exampleSource: example.source } : {}),
        source: 'demo', path: 'demo/lib/examples.js', group: group.key,
        regions: '', refs, citations: refs.map(ref => ({ ...EXAMPLE_SOURCES[ref - 1] })) })
    }
  }
  const entries = [], rejected = []
  for (const record of records) {
    const result = parse(record.sequence)
    if (result.problem) rejected.push({ ...record, problem: result.problem })
    else entries.push({ ...record, metrics: glyphAuditMetrics(result.tree) })
  }
  return { entries, rejected }
}

/** Overlapping pools ordered by descending leaves, depth, then operator count; ties retain
 * bundled source order. Candidates are unique by sequence + character, with every contributing
 * record in `attributions`. Top-level source fields describe the first attribution.
 * `limit` applies separately to each pool and never mutates entries.
 * Density is a structural audit heuristic; it does not estimate ink coverage or stroke count. */
export function selectGlyphAuditCandidates(entries, { minLeaves = 8, limit = Infinity } = {}) {
  if (!Number.isInteger(minLeaves) || minLeaves < 1) throw new RangeError('minLeaves must be a positive integer')
  if (limit !== Infinity && (!Number.isInteger(limit) || limit < 0)) throw new RangeError('limit must be a nonnegative integer or Infinity')
  const unique = new Map()
  for (const entry of entries) {
    const key = JSON.stringify([entry.sequence, entry.char])
    const found = unique.get(key)
    if (found) found.attributions.push(entry)
    else unique.set(key, { ...entry, attributions: [entry] })
  }
  const ranked = [...unique.values()].sort((a, b) => b.metrics.leaves - a.metrics.leaves
    || b.metrics.depth - a.metrics.depth || b.metrics.operators - a.metrics.operators)
  const dense = entry => entry.metrics.leaves >= minLeaves
  return {
    overlay: ranked.filter(entry => entry.metrics.overlay).slice(0, limit),
    enclosureDense: ranked.filter(entry => dense(entry) && entry.metrics.enclosure).slice(0, limit),
    dense: ranked.filter(dense).slice(0, limit),
  }
}
