import { beforeAll, describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseIdsTable } from '../src/adapter/babelstone.js'
import { parse } from '../src/core/ids.js'
import { EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { EXAMPLE_SOURCES } from '../demo/lib/example-sources.js'
import { glyphAuditMetrics, loadGlyphAuditCatalogue, selectGlyphAuditCandidates } from '../scripts/lib/glyph-audit-catalogue.mjs'

let catalogue
beforeAll(async () => { catalogue = await loadGlyphAuditCatalogue() })

describe('glyph audit catalogue', () => {
  it('retains every bundled table description and region without inventing expansions', async () => {
    for (const [source, path] of [['babelstone', 'data/babelstone-ids.tsv.gz'], ['yi-bai', 'data/yi-bai-ids.tsv.gz']]) {
      const text = gunzipSync(await readFile(new URL(`../${path}`, import.meta.url))).toString('utf8')
      const expected = [...parseIdsTable(text)].flatMap(([char, sequences]) => sequences.map(({ text: sequence, regions }) => ({ char, sequence, regions })))
      const records = [...catalogue.entries, ...catalogue.rejected].filter(entry => entry.source === source)
      expect(records).toHaveLength(expected.length)
      const keys = list => list.map(({ char, sequence, regions }) => JSON.stringify([char, sequence, regions])).sort()
      expect(keys(records)).toEqual(keys(expected))
      expect(records.every(record => record.path === path && record.headers.length > 0)).toBe(true)
    }
  })

  it('keeps demo metadata, group citation inheritance and explicit empty references', () => {
    const records = [...catalogue.entries, ...catalogue.rejected].filter(entry => entry.source === 'demo')
    expect(records).toHaveLength(EXAMPLE_GROUPS.reduce((sum, group) => sum + group.examples.length, 0))
    for (const group of EXAMPLE_GROUPS) for (const example of group.examples) {
      const record = records.find(entry => entry.group === group.key && entry.sequence === example.sequence && entry.char === example.char)
      const { source, ...metadata } = example
      expect(record).toMatchObject(metadata)
      if (source) expect(record.exampleSource).toBe(source)
      const refs = example.refs ?? group.refs ?? []
      expect(record.refs).toEqual(refs)
      expect(record.citations).toEqual(refs.map(ref => EXAMPLE_SOURCES[ref - 1]))
    }
  })

  it('reports parse failures separately and derives metrics from the application parser', () => {
    for (const entry of catalogue.entries) expect(entry.metrics).toEqual(glyphAuditMetrics(parse(entry.sequence).tree))
    for (const entry of catalogue.rejected) expect(entry.problem).toBe(parse(entry.sequence).problem)
  })

  it('finds nested overlays and enclosures in attested demo descriptions', () => {
    const entry = catalogue.entries.find(entry => entry.source === 'demo' && entry.sequence === '⿳宀⿰丨⿴⿻冂一一⿹𠃌灬')
    expect(entry.metrics).toEqual({ leaves: 7, operators: 5, depth: 4, overlay: true, enclosure: true })
    const selected = selectGlyphAuditCandidates([entry], { minLeaves: 4 })
    for (const pool of Object.values(selected)) expect(pool.map(item => item.sequence)).toEqual([entry.sequence])
  })

  it('deduplicates sequence + character while retaining every attribution', () => {
    const selected = selectGlyphAuditCandidates(catalogue.entries)
    const attributions = new Map()
    for (const entry of catalogue.entries) {
      const key = JSON.stringify([entry.sequence, entry.char])
      if (!attributions.has(key)) attributions.set(key, [])
      attributions.get(key).push(entry)
    }
    for (const pool of Object.values(selected)) {
      expect(new Set(pool.map(entry => JSON.stringify([entry.sequence, entry.char]))).size).toBe(pool.length)
      for (const candidate of pool) {
        expect(candidate.attributions).toEqual(attributions.get(JSON.stringify([candidate.sequence, candidate.char])))
      }
    }
    expect(selected.overlay.some(entry => new Set(entry.attributions.map(item => item.source)).size > 1)).toBe(true)
    expect(selected.overlay.some(entry => entry.metrics.leaves < 8)).toBe(true)
    expect(selected.enclosureDense.every(entry => entry.metrics.enclosure && entry.metrics.leaves >= 8)).toBe(true)
    expect(selected.dense.every(entry => entry.metrics.leaves >= 8)).toBe(true)
  })

  it('ranks deterministically, limits each category, and leaves input order intact', () => {
    const entries = catalogue.entries.slice()
    const all = selectGlyphAuditCandidates(entries, { minLeaves: 4 })
    const limited = selectGlyphAuditCandidates(entries, { minLeaves: 4, limit: 3 })
    for (const key of Object.keys(all)) expect(limited[key]).toEqual(all[key].slice(0, 3))
    expect(entries).toEqual(catalogue.entries)
    expect(selectGlyphAuditCandidates(entries, { limit: 0 })).toEqual({ overlay: [], enclosureDense: [], dense: [] })
    expect(() => selectGlyphAuditCandidates([], { minLeaves: 0 })).toThrow(RangeError)
    expect(() => selectGlyphAuditCandidates([], { limit: -1 })).toThrow(RangeError)
  })
})
