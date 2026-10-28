import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { smallSealAdapter } from '../src/adapter/index.js'
import { parse, write } from '../src/core/index.js'
import { smallSealSource } from '../src/composer/small-seal.js'
import { onlyBundled } from '../src/composer/local.js'
import { compose } from '../src/composer/loader.js'

const bytes = readFileSync(new URL('../data/small-seal.json.gz', import.meta.url))
const data = JSON.parse(gunzipSync(bytes))
const seal = String.fromCodePoint(0x3D10C) // 玨
const jade = String.fromCodePoint(0x3D06D)
const sequence = `⿰${jade}${jade}`
const table = new Map([['玨', [{ text: '⿰王王', regions: '' }]]])
const adapter = smallSealAdapter({ data, table, palette: [] })

it('preserves every Jiguge source record and excludes unresolved data from the editor', () => {
  expect(data.records).toHaveLength(11114)
  expect(Object.keys(data.table)).toHaveLength(49)
  expect(data.parts).toHaveLength(1383)
  const statuses = {}
  for (const record of data.records) for (const d of record.descriptions) {
    statuses[d.status] = (statuses[d.status] ?? 0) + 1
    if (d.status === 'ready') expect(data.table[record.char]).toContain(d.text)
  }
  expect(statuses).toEqual({ empty: 337, unresolved: 747, ready: 49, 'unmapped-head': 10010 })
  for (const sequences of Object.values(data.table)) for (const text of sequences) {
    const parsed = parse(text)
    expect(parsed.problem).toBeUndefined()
    expect(write(parsed.tree)).toBe(text)
    expect(text).not.toContain('&')
  }
  expect(data.records.filter(r => r.descriptions.some(d => d.kind === 'apparent'))).toHaveLength(29)
})

it('looks up seal decompositions without replacing modern Han structures', async () => {
  expect(await adapter.structure(seal)).toEqual([{ text: sequence, regions: '' }])
  expect(await adapter.structure('玨')).toEqual([{ text: '⿰王王', regions: '' }])
  expect(await adapter.structure(String.fromCodePoint(0x3FC3F))).toEqual([])
  expect(await adapter.encoded(sequence)).toEqual([seal])
  expect(await adapter.encoded('⿰王王')).toEqual(['玨'])
  expect((await adapter.search('玨')).map(h => h.char)).toEqual(['玨', seal])
  expect((await adapter.search('U+3D10C')).map(h => h.char)).toEqual([seal, '玨', '珏'])
  expect((await adapter.search(seal)).map(h => h.char)).toEqual([seal, '玨', '珏'])
  expect((await adapter.parts()).every(p => p.kind === 'seal')).toBe(true)
})

it('finds curated crosswalk forms from modern variants', async () => {
  const zheng = String.fromCodePoint(0x3DB6E)
  expect((await adapter.search('爭')).map(h => h.char)).toContain(zheng)
  expect((await adapter.search('争')).map(h => h.char)).toContain(zheng)
  expect((await adapter.search(zheng)).map(h => h.char)).toEqual(expect.arrayContaining(['爭', '争']))
  const part = (await adapter.parts()).find(p => p.part === zheng)
  expect(part.sealBasis).toBe('crosswalk')
  expect(part.sealGroup).toBe('other')
})

it('finds seal characters by their parts and keeps result limits', async () => {
  expect((await adapter.containing(jade + jade)).items).toContain(seal)
  expect((await adapter.findByIds(sequence)).hits.map(h => h.char)).toContain(seal)
  expect((await adapter.findByIds('⿰王王')).hits.map(h => h.char)).toContain('玨')
  expect(await adapter.search('玨', { limit: 0 })).toEqual([])
  expect((await adapter.findByIds(jade, { limit: 0 })).hits).toEqual([])
  expect((await adapter.containing(jade, { limit: 0 })).items).toEqual([])
  const controller = new AbortController()
  controller.abort()
  await expect(adapter.structure(seal, { signal: controller.signal })).rejects.toThrow()
  await expect(adapter.search('玨', { signal: controller.signal })).rejects.toThrow()
})

it('shares a lazy fetch, reads gzip, and retries failed loads', async () => {
  let calls = 0
  const lazy = smallSealAdapter({ data: '/seal.gz', fetch: async () => { calls++; return new Response(bytes) } })
  expect(calls).toBe(0)
  await Promise.all([lazy.structure(seal), lazy.parts(), lazy.search('玨')])
  expect(calls).toBe(1)
  let failures = 0
  const retry = smallSealAdapter({ data: '/seal.gz', fetch: async () => ++failures === 1 ? new Response('', { status: 503 }) : new Response(bytes) })
  await expect(retry.structure(seal)).rejects.toThrow('503')
  expect(await retry.structure(seal)).toHaveLength(1)
  expect(failures).toBe(2)
  await expect(smallSealAdapter({ data: { ...data, format: 2 } }).parts()).rejects.toThrow('format')
})

it('draws supported seal glyphs locally, including edited descriptions and empty slots', async () => {
  const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/small-seal-outlines.json.gz', import.meta.url))))
  const source = smallSealSource({ load: async () => outlines })
  expect(onlyBundled(sequence)).toBe(true)
  expect(onlyBundled(`⿰${jade}木`)).toBe(false)
  const exact = await compose(source, sequence)
  expect(exact.d.length).toBeGreaterThan(100)
  const edited = await compose(source, `⿱${jade}${jade}`)
  expect(edited.d.length).toBeGreaterThan(100)
  expect(edited.d).not.toBe(exact.d)
  const partial = await compose(source, `⿰${jade}⬚`)
  expect(partial.slots).toHaveLength(1)
  for (const part of data.parts) expect(outlines.records[part.part]).toBeDefined()
  for (const char of Object.keys(data.table)) expect(outlines.records[char]).toBeDefined()
  await expect(compose(source, `⿰${jade}${String.fromCodePoint(0x3FC3F)}`)).rejects.toThrow()
})

it('expands Han leaves inside seal IDS and deduplicates overlapping input tables', async () => {
  const grass = String.fromCodePoint(0x3D128), head = String.fromCodePoint(0x3D17B)
  const combined = smallSealAdapter({ data, table: new Map([
    ['浸', [{ text: '⿰氵𠬶', regions: '' }]],
    [seal, [{ text: sequence, regions: '' }]],
  ]) })
  expect((await combined.findByIds(grass + '氵')).hits.map(h => h.char)).toContain(head)
  expect((await combined.containing(grass + '氵')).items).toContain(head)
  const found = await combined.findByIds(sequence)
  expect(found.hits.filter(h => h.char === seal)).toHaveLength(1)
  expect(found.total).toBe(found.hits.length)
  expect(data.table[head]).toEqual([`⿱${grass}浸`])
})

it('cross-searches seal and CJK components in either direction', async () => {
  const cross = smallSealAdapter({ data, table: new Map([
    ['珏', [{ text: '⿰玉玉', regions: '' }]],
    ['宝', [{ text: '⿱宀玉', regions: '' }]],
  ]) })
  for (const query of ['玉玉', jade + jade, jade + '玉', '⿰玉玉', sequence]) {
    const result = await cross.findByIds(query)
    expect(result.hits.map(h => h.char)).toContain(seal)
    expect(result.hits.map(h => h.char)).toContain('珏')
    expect(result.hits.map(h => h.char)).not.toContain('宝')
    expect(result.hits.find(h => h.char === seal).sequence).toBe(sequence)
    expect(result.hits.find(h => h.char === '珏').sequence).toBe('⿰玉玉')
  }
  for (const query of ['玉玉', jade + jade, jade + '玉']) {
    expect((await cross.containing(query)).items).toContain(seal)
    expect((await cross.containing(query)).items).toContain('珏')
    expect((await cross.containing(query)).items).not.toContain('宝')
  }
  expect(await cross.encoded('⿰玉玉')).toEqual(['珏'])
  expect(await cross.encoded(sequence)).toEqual([seal])
  expect((await cross.search('U+3D10C', { limit: 1 })).map(h => h.char)).toEqual([seal])
})

it('combines radical folds and multiple modern spellings in search groups', async () => {
  const water = String.fromCodePoint(0x3D000), ambiguous = String.fromCodePoint(0x3D001)
  const cross = smallSealAdapter({
    data: { format: 1, parts: [], modern: { [water]: ['水', '氵'], [ambiguous]: ['茶', '荼'] }, table: {
      [seal]: [`⿰${water}${water}`], [ambiguous]: ['⿰木木'],
    } },
    formsText: '氵\t水\n',
    table: new Map([['沝', [{ text: '⿰水氵', regions: '' }]], ['字', [{ text: '⿰茶木', regions: '' }]]]),
  })
  for (const query of ['水氵', water + water, `⿰${water}氵`]) {
    expect((await cross.findByIds(query)).hits.map(h => h.char)).toEqual(expect.arrayContaining(['沝', seal]))
  }
  expect((await cross.search(ambiguous)).map(h => h.char)).toEqual([ambiguous, '茶', '荼'])
  expect((await cross.findByIds('荼木')).hits.map(h => h.char)).toContain('字')
  expect((await cross.findByIds(ambiguous + '木')).hits.map(h => h.char)).toContain('字')
  expect((await cross.findByIds('茶荼')).hits.map(h => h.char)).not.toContain('字')
})

it('preserves literal component queries and subtraction in containing searches', async () => {
  const cross = smallSealAdapter({ data: { format: 1, modern: {}, table: {}, parts: [] }, table: new Map([
    ['乙', [{ text: '⿰LR', regions: '' }]],
    ['丙', [{ text: '⿰木土', regions: '' }]],
    ['林', [{ text: '⿰木木', regions: '' }]],
    ['森', [{ text: '⿱木林', regions: '' }]],
    ['甲', [{ text: '㇯森木', regions: '' }]],
  ]) })
  expect((await cross.containing('LR')).items).toEqual(['乙'])
  expect((await cross.containing('木木')).items).toEqual(expect.arrayContaining(['林', '森', '甲']))
})

it('looks up mappings even when the seal has no resolved decomposition', async () => {
  const unmappedStructure = String.fromCodePoint(0x3D001)
  expect((await adapter.search(unmappedStructure)).map(h => h.char)).toContain('弌')
  expect((await adapter.search('弌')).map(h => h.char)).toContain(unmappedStructure)
  expect(await adapter.structure(unmappedStructure)).toEqual([])
})

it('offers basic seal parts beyond the resolved IDS subset with explicit grouping evidence', () => {
  for (const char of ['木', '水', '口', '人']) {
    const part = data.parts.find(p => p.modern.includes(char))
    expect(part).toBeDefined()
    expect(part.sealGroup).toBe('basic')
    expect(part.sealBasis).toBe('selected')
  }
  for (const char of ['祖', '祭', '皇', '莠', '英', '番']) {
    expect(data.parts.find(p => p.modern.includes(char)).sealGroup).toBe('compound')
  }
  const inferred = data.parts.filter(p => p.sealBasis === 'cjk-ids')
  expect(inferred.length).toBeGreaterThan(300)
  expect(inferred.every(p => p.modernIds.length && p.sealGroup === 'compound')).toBe(true)
  expect(inferred.every(p => !data.table[p.part])).toBe(true)
  expect(data.parts.filter(p => p.sealBasis === 'unknown').every(p => p.sealGroup === 'other')).toBe(true)
})
