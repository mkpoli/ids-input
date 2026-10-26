import { describe, expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { babelStoneAdapter, componentIndex, parseIdsTable, paletteRows } from '../src/adapter/index.js'

const TABLE = `# header
一\t一(GHTJKPV)
木\t⿻十八(GHTJKPV)
十\t⿻一丨(GHTJKPV)
林\t⿰木木(GHTJKPV)
森\t⿱木林(GHTJKPV)
本\t⿻木一(GHTJKPV)
骨\t⿳𭁟冖⺝(GHTJKV) ⿳𭁟冖⺼(T)
滑\t⿰氵骨(GHTJKPV)
乌\t㇯鸟丶(G)
鸟\t⿹⿱丿㇆⿱丶一(G)
兀\t⿱一儿(GHTJKPV)
彡\t⿹{22}一(G)
`
const table = parseIdsTable(TABLE)

describe('the compact table', () => {
  it('reads each description with its regions', () => {
    expect(table.get('骨')).toEqual([{ text: '⿳𭁟冖⺝', regions: 'GHTJKV' }, { text: '⿳𭁟冖⺼', regions: 'T' }])
    expect(table.has('#')).toBe(false)
  })
})

describe('the BabelStone adapter', () => {
  const served = new Map([['ids.tsv.gz', gzipSync(TABLE)], ['plain.tsv', Buffer.from(TABLE)]])
  const requests = []
  const fetch = async url => { requests.push(url); return served.has(url) ? new Response(served.get(url)) : new Response('', { status: 404 }) }

  it('reads a gzipped table once, and answers a character\'s descriptions', async () => {
    const adapter = babelStoneAdapter({ ids: 'ids.tsv.gz', fetch })
    expect(await adapter.structure('骨')).toEqual(table.get('骨'))
    expect(await adapter.structure('林')).toEqual([{ text: '⿰木木', regions: 'GHTJKPV' }])
    expect(requests.filter(url => url === 'ids.tsv.gz')).toHaveLength(1)
  })
  it('reads a table served uncompressed', async () => {
    expect(await babelStoneAdapter({ ids: 'plain.tsv', fetch }).structure('滑')).toEqual([{ text: '⿰氵骨', regions: 'GHTJKPV' }])
  })
  it('gives no descriptions for a character that names only itself, or none at all', async () => {
    const adapter = babelStoneAdapter({ table })
    expect(await adapter.structure('一')).toEqual([])
    expect(await adapter.structure('丨')).toEqual([])
  })
  it('keeps a sequence naming an unencoded component', async () => {
    expect(await babelStoneAdapter({ table }).structure('彡')).toEqual([{ text: '⿹{22}一', regions: 'G' }])
  })
  it('fails, and tries again on the next call, when the table cannot be loaded', async () => {
    const adapter = babelStoneAdapter({ ids: 'missing.tsv', fetch })
    await expect(adapter.structure('木')).rejects.toThrow('404')
    await expect(adapter.structure('木')).rejects.toThrow('404')
    expect(requests.filter(url => url === 'missing.tsv')).toHaveLength(2)
  })
  it('finds components by character or code point', async () => {
    const adapter = babelStoneAdapter({ table })
    expect(await adapter.search('木 骨')).toEqual([{ char: '木', label: 'U+6728' }, { char: '骨', label: 'U+9AA8' }])
    expect((await adapter.search('U+2EBC')).map(found => found.char)).toEqual(['⺼'])
    expect((await adapter.search('6728')).map(found => found.char)).toEqual(['木'])
    expect(await adapter.search('face')).toEqual([])
    expect(await adapter.search('K')).toEqual([{ char: 'K', label: 'U+004B' }])
    expect((await adapter.search('コマ')).map(found => found.char)).toEqual(['コ', 'マ'])
  })
  it('finds the characters built from parts', async () => {
    const adapter = babelStoneAdapter({ table })
    expect(await adapter.containing('木木')).toEqual({ items: ['林', '森'], more: false })
    expect((await adapter.containing('氵冖')).items).toEqual(['滑'])
    expect((await adapter.containing('木一', { limit: 1 }))).toEqual({ items: ['本'], more: true })
  })
  it('reads the palette rows as objects', async () => {
    const document = { columns: ['part', 'uses', 'strokes', 'derived', 'first', 'kind'], parts: [['亻', 3, 2, 0, '撇', 'c']] }
    expect(paletteRows(document)).toEqual([{ part: '亻', uses: 3, strokes: 2, derived: 0, first: '撇', kind: 'c' }])
    expect(await babelStoneAdapter({ palette: paletteRows(document) }).parts()).toHaveLength(1)
  })
})

describe('the component search', () => {
  const index = componentIndex(new Map([...table].map(([char, sequences]) => [char, sequences.map(s => s.text)])))
  it('counts components through every level', () => {
    expect(Object.fromEntries(index.components('森'))).toEqual({ 木: 3, 林: 1, 十: 3, 八: 3, 一: 3, 丨: 3 })
  })
  it('takes the most any one regional description holds, never the sum', () => {
    expect(index.components('骨').get('冖')).toBe(1)
    expect(index.components('骨').get('⺝')).toBe(1)
    expect(index.components('骨').get('⺼')).toBe(1)
  })
  it('takes a subtracted part away', () => {
    expect(index.components('乌').has('鸟')).toBe(false)
    expect(index.components('乌').has('丶')).toBe(false)
  })
  it('ranks characters holding more of the parts at their top level first', () => {
    expect(index.search('木林').items).toEqual(['森'])
    expect(index.search('木').items).toEqual([])
    expect(index.search('一二三四五六七八九').items).toEqual([])
  })
})

describe('the shipped data', () => {
  const ids = parseIdsTable(require('node:zlib').gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString())
  it('holds every ideograph of BabelStone IDS', () => {
    expect(ids.size).toBe(97680 + 6145)
    expect(ids.get('滑')?.map(s => s.text)).toContain('⿰氵骨')
  })
  it('finds 滑 by 水骨\'s written forms, 氵 and 骨, and 林 and 森 by 木木', () => {
    const index = componentIndex(new Map([...ids].map(([char, sequences]) => [char, sequences.map(s => s.text)])))
    expect(index.search('氵骨', 200).items).toContain('滑')
    const trees = index.search('木木', 200).items
    expect(trees).toContain('林')
    expect(trees).toContain('森')
    expect(trees).not.toContain('本')
  })
  it('lists the palette parts', () => {
    const palette = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8')))
    expect(palette.length).toBeGreaterThan(1000)
    expect(new Set(palette.map(part => part.kind))).toEqual(new Set(['c', 't', 'd', 's']))
  })
})

describe('an encoded character', () => {
  it('is found by the description it has, exactly', async () => {
    const adapter = babelStoneAdapter({ table })
    expect(await adapter.encoded('⿰木木')).toEqual(['林'])
    expect(await adapter.encoded('⿳𭁟冖⺼')).toEqual(['骨'])
    expect(await adapter.encoded('⿰木口')).toEqual([])
    expect(await adapter.encoded('一')).toEqual([])
  })
  it('answers callers who ask while the table loads, and tries again after a failed load', async () => {
    let fail = true
    const fetch = async () => { if (fail) { fail = false; return new Response('', { status: 503 }) } return new Response(TABLE) }
    const adapter = babelStoneAdapter({ ids: 'ids.tsv', fetch })
    await expect(adapter.encoded('⿰木木')).rejects.toThrow('503')
    const [a, b] = await Promise.all([adapter.encoded('⿰木木'), adapter.encoded('⿰木木')])
    expect([a, b]).toEqual([['林'], ['林']])
  })
})

describe('the description search', () => {
  it('finds characters by a structure with empty slots, folding forms, on the caller\'s thread without a worker', async () => {
    const adapter = babelStoneAdapter({ table, formsText: 'form\tchar\tsource\tdetail\n⺡\t氵\tunicode-ucd\tx\n' })
    const { hits, total } = await adapter.findByIds('⿰？木')
    expect(hits.map(h => h.char)).toEqual(['林', '森'])
    expect(total).toBe(2)
    expect((await adapter.findByIds('⿱木⿰木木')).hits[0]).toMatchObject({ char: '森', sequence: '⿱木⿰木木', spans: [[0, 5]] })
    expect((await adapter.findByIds('⿰⺡骨')).hits.map(h => h.char)).toEqual(['滑'])
  })
})
