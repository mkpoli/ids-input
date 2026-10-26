import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { babelStoneAdapter, parseIdsTable, paletteRows } from '../src/adapter/index.js'
import { isComponent, parse, write } from '../src/core/index.js'

const table = parseIdsTable(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString())
const parts = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))))
const adapter = babelStoneAdapter({ table, palette: parts })

it('accepts Tangut characters and components, including supplementary blocks', () => {
  for (const point of [0x17000, 0x187F7, 0x18800, 0x18AFF, 0x18D00, 0x18D1E, 0x18D80, 0x18DF2]) {
    expect(isComponent(String.fromCodePoint(point))).toBe(true)
  }
  for (const point of [0x16FFF, 0x18B00, 0x18CFF, 0x18E00]) expect(isComponent(String.fromCodePoint(point))).toBe(false)
  const tangut = [...table].filter(([char]) => /[\u{17000}-\u{187FF}\u{18D00}-\u{18D7F}]/u.test(char))
  expect(tangut).toHaveLength(6145)
  const malformed = []
  for (const [char, sequences] of tangut) for (const { text } of sequences) {
    if ([...text].length === 1) { expect(isComponent(text)).toBe(true); continue }
    const result = parse(text)
    if (result.problem) { malformed.push(char); continue }
    expect(result.problem).toBeUndefined()
    expect(write(result.tree)).toBe(text)
  }
  // Preserve these eight malformed source records without inventing corrections.
  expect(malformed).toEqual([...'𗆽𗈫𗈬𗌜𗓜𗱋𗽉𗽧'])
})

it('finds Tangut by character, code point, component and full IDS', async () => {
  expect((await adapter.search('U+17000 U+18800')).map(hit => hit.char)).toEqual(['𗀀', '𘠀'])
  expect(await adapter.structure('𗀀')).toEqual([{ text: '⿱𘠀⿰𘢰𘠆', regions: '' }])
  expect(await adapter.encoded('⿱𘠀⿰𘢰𘠆')).toContain('𗀀')
  expect((await adapter.findByIds('⿱𘠀⿰𘢰𘠆')).hits.map(hit => hit.char)).toContain('𗀀')
  expect((await adapter.containing('𘠀𘢰𘠆', { limit: 100 })).items).toContain('𗀀')
})

it('provides all 768 original Tangut components in code point order', () => {
  const tangut = parts.filter(part => part.kind === 't')
  expect(tangut.map(part => part.part)).toEqual(Array.from({ length: 768 }, (_, i) => String.fromCodePoint(0x18800 + i)))
  expect(tangut.find(part => part.part === '𘠀').uses).toBeGreaterThan(0)
  expect(tangut.every(part => part.strokes === null && part.first === null)).toBe(true)
})
