// CHROMIUM_PATH=/path/to/chrome bun scripts/audit_glyph_layout.mjs OUTPUT_DIR [--limit N] [--style sans|serif]
// A complete catalogue inventory, followed by a bounded structural-risk render audit.
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { compose, LookupError } from '../src/composer/loader.js'
import { Composer } from '../src/composer/compose.js'
import { splitDescription } from '../src/core/ids.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'
import { loadGlyphAuditCatalogue, selectGlyphAuditCandidates } from './lib/glyph-audit-catalogue.mjs'
import { auditGlyphMetrics, auditGlyphMetricCoverage, GLYPH_AUDIT_THRESHOLDS } from './lib/glyph-audit-metrics.mjs'
import { glyphAuditConfidence } from './lib/glyph-audit-confidence.mjs'
import { cachedAuditSource } from './lib/glyph-audit-source.mjs'
import { createRasterComparator } from './lib/glyph-audit-raster.mjs'

const args = process.argv.slice(2)
const output = args.shift()
if (!output || output.startsWith('--')) throw Error('Usage: bun scripts/audit_glyph_layout.mjs OUTPUT_DIR [--limit N] [--style sans|serif]')
let limit = Infinity, style = 'sans'
while (args.length) {
  const flag = args.shift(), value = args.shift()
  if (flag === '--limit' && /^\d+$/.test(value ?? '') && Number(value) > 0) limit = Number(value)
  else if (flag === '--style' && ['sans', 'serif'].includes(value)) style = value
  else throw Error(`Invalid option: ${flag} ${value}`)
}
const directory = resolve(output)
await mkdir(directory, { recursive: true })
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const { entries, rejected } = await loadGlyphAuditCatalogue()
const pools = selectGlyphAuditCandidates(entries)
const candidates = [...new Map([...pools.dense, ...pools.overlay].map(entry => [JSON.stringify([entry.sequence, entry.char]), entry])).values()]
const selected = candidates.slice(0, limit)
const mappings = new Map()
for (const entry of candidates) {
  const chars = mappings.get(entry.sequence) ?? new Set()
  if (entry.char) chars.add(entry.char)
  mappings.set(entry.sequence, chars)
}
const poolCounts = rows => ({ overlay: rows.filter(row => row.metrics.overlay).length,
  dense: rows.filter(row => row.metrics.leaves >= 8).length,
  denseEnclosure: rows.filter(row => row.metrics.leaves >= 8 && row.metrics.enclosure).length })
const sourceManager = cachedAuditSource(COMPOSER_BASES[style], resolve('cache/glyph-layout'))
let source = sourceManager.create()
const rows = []
const sourcePaths = ['data/babelstone-ids.tsv.gz', 'data/yi-bai-ids.tsv.gz', 'demo/lib/examples.js', 'demo/lib/example-sources.js']
const implementationPaths = ['scripts/audit_glyph_layout.mjs', ...['glyph-audit-catalogue', 'glyph-audit-metrics', 'glyph-audit-confidence', 'glyph-audit-source', 'glyph-audit-raster'].map(name => `scripts/lib/${name}.mjs`),
  ...(await readdir(new URL('../src/composer/', import.meta.url))).filter(name => /\.(js|json)$/.test(name)).map(name => `src/composer/${name}`)]
const hashesOf = async paths => Object.fromEntries(await Promise.all(paths.map(async path => [path, digest(await readFile(new URL(`../${path}`, import.meta.url)))])))
const report = {
  schema: 1, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), style,
  scope: 'Direct composer audit of the bundled BabelStone and Yi Bai tables plus demo examples, in the selected Sans or Serif export. Dense descriptions (eight or more leaves) are rendered first, then remaining overlay descriptions, without recursive expansion. Demo routing, Kaisho, script-specific worker sources and document transforms are outside this scan. Placement-box flags and selected-export raster differences require visual review; operands may use fallback fonts. Unflagged cases are not certified correct.',
  thresholds: { ...GLYPH_AUDIT_THRESHOLDS, minLeaves: 8, lowIou: 0.35, lowInkRatio: 0.55, highInkRatio: 1.8 },
  catalogue: { records: entries.length + rejected.length, parseable: entries.length, rejected: rejected.length,
    overlay: pools.overlay.length, dense: pools.dense.length, denseEnclosure: pools.enclosureDense.length,
    candidates: candidates.length, selected: selected.length, selectedPools: poolCounts(selected) },
  sources: sourcePaths.map(path => ({ path, headers: entries.find(entry => entry.path === path)?.headers ?? [] })),
  sourceHashes: await hashesOf(sourcePaths), implementationHashes: await hashesOf(implementationPaths),
  complete: false, rows,
}
const save = async () => {
  report.export = sourceManager.provenance()
  report.summary = { evaluated: rows.length, flagged: rows.filter(row => row.flags?.length).length,
    withNativeReference: rows.filter(row => row.reference === 'native').length,
    errors: rows.filter(row => row.error).length, evaluatedPools: poolCounts(rows),
    overlayPlacementEligible: rows.filter(row => row.coverage?.rootOverlay.eligible).length,
    overlayPlacementSkipped: Object.fromEntries([...new Set(rows.map(row => row.coverage?.rootOverlay.skippedReason).filter(Boolean))]
      .map(reason => [reason, rows.filter(row => row.coverage?.rootOverlay.skippedReason === reason).length])),
    demoOverridePossible: rows.filter(row => row.confidence?.demoRouting === 'override-possible').length }
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
}
const attribution = entry => ({ source: entry.source, path: entry.path, char: entry.char, sequence: entry.sequence,
  regions: entry.regions, group: entry.group, refs: entry.refs, citations: entry.citations })
console.log(JSON.stringify(report.catalogue))
const comparator = await createRasterComparator()
try {
  for (const [index, entry] of selected.entries()) {
    // A fresh source bounds decoded host-list retention; downloaded shards remain on disk.
    if (index && index % 128 === 0) source = sourceManager.create()
    const row = { id: digest(JSON.stringify([entry.sequence, entry.char])).slice(0, 16),
      char: entry.char ?? null, sequence: entry.sequence, metrics: entry.metrics,
      attributions: entry.attributions.map(attribution), flags: [] }
    let drawn, reference
    try {
      drawn = await compose(source, entry.sequence, { separate: true, fontStyle: style })
      const { base, marks } = splitDescription(entry.sequence)
      const tree = new Composer(source.store(), { fontStyle: style }).parse(base)
      const options = { known: Boolean(entry.char), layout: 'auto', allowOrderedGlyphOrigins: !marks && !entry.sequence.includes('[') }
      row.flags = auditGlyphMetrics(tree, drawn, options)
      row.coverage = auditGlyphMetricCoverage(tree, drawn, options)
      row.origins = drawn.origins
      row.cells = Boolean(drawn.cells)
      row.missing = drawn.missing
    } catch (error) {
      if (!(error instanceof LookupError)) throw error
      row.error = { kind: 'composition', message: error.message }
    }
    if (entry.char && [...entry.char].length === 1) {
      try {
        const possible = await compose(source, entry.char, { fontStyle: style })
        if (source.hasExportGlyph(entry.char) && !possible.missing?.length && possible.origins?.length === 1 && possible.origins[0] === `glyph ${entry.char}`) reference = possible
      } catch (error) { if (!(error instanceof LookupError)) throw error }
    }
    row.reference = reference ? 'native' : 'unavailable'
    if (drawn && reference) {
      row.raster = await comparator.compare(drawn, reference)
      if (row.raster.referencePixels > 0) {
        if (row.raster.iou < report.thresholds.lowIou) row.flags.push({ code: 'low-native-overlap', reviewCandidate: true })
        if (row.raster.inkRatio < report.thresholds.lowInkRatio || row.raster.inkRatio > report.thresholds.highInkRatio) row.flags.push({ code: 'native-ink-ratio', reviewCandidate: true })
      } else row.reference = 'empty-native-mask'
    }
    row.confidence = glyphAuditConfidence(row, { style, characters: [...mappings.get(entry.sequence)] })
    if (row.flags.length || row.error) {
      await writeFile(join(directory, `${row.id}.json`), JSON.stringify({ ...row, drawn, native: reference }) + '\n')
    }
    rows.push(row)
    if ((index + 1) % 25 === 0) {
      await save()
      console.log(`${rows.length}/${selected.length}: ${report.summary.flagged} flagged, ${report.summary.errors} errors; RSS ${Math.round(process.memoryUsage().rss / 1048576)} MiB`)
    }
  }
  report.complete = selected.length === candidates.length
} catch (error) {
  report.fatal = String(error?.stack ?? error)
  throw error
} finally {
  try { await save() } finally { await comparator.close() }
}
console.log(JSON.stringify(report.summary))
