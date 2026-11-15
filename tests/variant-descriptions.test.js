// A variation sequence is described from the glyph GlyphWiki registers for it.
import { expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createDescriber, glyphName, rowsOf } from '../scripts/lib/variant-descriptions.mjs'
import { isOwnDescription, readVariantDescriptions } from '../src/core/variant-descriptions.js'
import { parse, write } from '../src/core/ids.js'

// Rows of GlyphWiki's dump of 2026-11-14: the glyphs of a few sequences and every glyph they place.
const rows = JSON.parse(await readFile(new URL('./fixtures/variant-glyphs.json', import.meta.url), 'utf8'))
const glyphs = new Map(Object.entries(rows).map(([name, [related, data]]) => [name, { related: /** @type {string} */ (related), data: /** @type {string} */ (data) }]))
const tables = { '突': ['⿱穴犬', '⿱⿱宀儿犬', '⿱⿱宀儿大'], '辻': ['⿺辶十'], '坪': ['⿰土平'], '旲': ['⿱日大'], '臭': ['⿱自犬', '⿱自大'], '葛': ['⿱艹曷'], '穴': ['⿱宀八'],
  '僧': ['⿰亻曾', '⿰亻曽'], '亨': ['⿳亠口了'], '㷭': ['⿱逢火'], '裒': ['⿳亠臼𧘇', '⿳亠𦥑𧘇', '⿱亠𮍦'], '蓬': ['⿱艹逢'], '卅': ['⿻一川', '⿻廾丨'] }
const ucv = JSON.parse(await readFile(new URL('../data/ucv.json', import.meta.url), 'utf8'))
const describe = createDescriber(glyphs, char => tables[/** @type {keyof typeof tables} */ (char)] ?? [], ucv, new Map([['\u{FA5E}', '艹\u{FE00}'], ['\u{FA66}', '辶\u{FE00}']]))
const sequence = (/** @type {number[]} */ ...points) => String.fromCodePoint(...points)

it('names the glyph of a sequence as GlyphWiki does', () => {
  expect(glyphName(sequence(0x7a81, 0xe0102))).toBe('u7a81-ue0102')
  expect(glyphName(sequence(0x7a81, 0xfe00))).toBe('u7a81-ufe00')
})

it('reads the glyphs a glyph places and the points of its strokes', () => {
  expect(rowsOf('99:0:0:0:1:200:219:u7a74-03$99:0:0:5:-15:195:200:u5927-04@2')).toEqual({
    placed: [{ name: 'u7a74-03', frame: [0, 1, 200, 219] }, { name: 'u5927-04', frame: [5, -15, 195, 200] }], points: [] })
  expect(rowsOf('1:0:0:14:103:186:69$0:0:0:0').points).toEqual([[14, 103], [186, 69]])
})

it('describes a sequence by the components of its glyph', () => {
  // 突 with 大 and with 犬: the figures of Adobe-Japan1 and of Moji_Joho, and the standardized one.
  expect(describe(sequence(0x7a81, 0xe0100))).toEqual({ description: '⿱穴大', how: 'placed', glyph: 'u7a81-jn' })
  expect(describe(sequence(0x7a81, 0xe0102))?.description).toBe('⿱穴大')
  expect(describe(sequence(0x7a81, 0xe0103))).toEqual({ description: '⿱穴犬', how: 'composed', glyph: 'ufa55-jn' })
  expect(describe(sequence(0x7a81, 0xfe00))?.description).toBe('⿱穴犬')
  expect(describe(sequence(0x81ed, 0xe0100))?.description).toBe('⿱自大')
})

it('describes a glyph drawn from strokes as its character and says so', () => {
  const found = describe(sequence(0x7a81, 0xe0104))
  expect(found).toEqual({ description: '⿱穴犬', how: 'drawn', glyph: 'u7a81-ue0104' })
  expect(isOwnDescription(found ?? undefined)).toBe(false)
})

it('takes a description GlyphWiki names the glyph by', () => {
  expect(describe(sequence(0x65f2, 0xe0102))).toEqual({ description: '⿱日犬', how: 'named', glyph: 'u2ff1-u65e5-u72ac' })
})

it('writes a component whose glyph is another character\'s as that character', () => {
  // 辶 of one dot is ⻌ U+2ECC, whose glyph is that of the compatibility ideograph U+FA66.
  expect(describe(sequence(0x8fbb, 0xe0100))?.description).toBe('⿺\u{2ECC}十')
  expect(describe(sequence(0x8fbb, 0xe0101))?.description).toBe('⿺辶十')
  // 艹 of four strokes at the top is ⺿ U+2EBF.
  expect(describe(sequence(0x845b, 0xe0107))?.description.startsWith('⿱\u{2EBF}')).toBe(true)
})

it('writes a component whose glyph is registered for a sequence as that sequence', () => {
  // 坪 with the 平 of 平 U+E0101, the form of the K source.
  expect(describe(sequence(0x576a, 0xe0100))?.description).toBe('⿰土平')
  expect(describe(sequence(0x576a, 0xe0101))?.description).toBe(`⿰土平${sequence(0xe0101)}`)
})

it('writes a source\'s form of a component with the source\'s letter', () => {
  expect(describe(sequence(0x845b, 0xe0101))?.description).toBe('⿱艹曷J')
})

it('writes a form of a component variation entry with its identifier', () => {
  // 僧 with the fourth form of UCV #187, 曽.
  expect(describe(sequence(0x50e7, 0xe0103))?.description).toBe('⿰亻曽q1874')
})

it('writes a component under its own character where two characters share a glyph', () => {
  // GlyphWiki draws 了 and 𠄏 U+2010F as one glyph.
  expect(describe(sequence(0x4ea8, 0xe0100))?.description).toBe('⿳亠口了')
})

it('reads a glyph of another glyph set as the glyph it is another name of', () => {
  // `j78-3029` is the plain glyph of 逢.
  expect(describe(sequence(0x3ded, 0xe0100))).toEqual({ description: '⿱逢火', how: 'composed', glyph: 'u3ded-j' })
})

it('places no component that lies outside the part it would stand for', () => {
  // 裒: 衣 encloses 𦥑 and fills the square, so it is no third of ⿳亠𦥑𧘇 nor half of ⿱亠𮍦.
  expect(describe(sequence(0x88d2, 0xe0100))).toEqual({ description: '⿳亠臼𧘇', how: 'drawn', glyph: 'u88d2' })
  // 卅: three 十 side by side are not the overlaid parts of ⿻一川.
  expect(describe(sequence(0x5345, 0xe0102))?.how).toBe('drawn')
})

it('writes no compatibility ideograph in a description GlyphWiki names a glyph by', () => {
  expect(describe(sequence(0x84ec, 0xe0105))).toEqual({ description: '⿺\u{2ECC}莑', how: 'named', glyph: 'u2ffa-ufa66-u8391' })
})

it('refers to the glyph of a form no notation writes', () => {
  // 葛 with the second form of UCV #323; without the list, only the glyph's name tells it.
  expect(describe(sequence(0x845b, 0xe0100))?.description).toBe('⿱艹曷q3232')
  const unlisted = createDescriber(glyphs, char => tables[/** @type {keyof typeof tables} */ (char)] ?? [])
  expect(unlisted(sequence(0x845b, 0xe0100))?.description).toBe('⿱艹&GW-u66f7-var-002;')
})

it('describes no sequence GlyphWiki registers no glyph for', () => {
  expect(describe(sequence(0x4e00, 0xe0100))).toBeNull()
})

it('holds a description for every sequence of the registry and every standardized one', async () => {
  const text = gunzipSync(await readFile(new URL('../data/variant-descriptions.tsv.gz', import.meta.url))).toString('utf8')
  const table = readVariantDescriptions(text)
  expect(table.size).toBe(30644)
  expect(table.get(sequence(0x7a81, 0xe0103))).toEqual({ description: '⿱穴犬', how: 'composed', glyph: 'ufa55-jn' })
  expect(table.get(sequence(0x8fbb, 0xe0100))?.description).toBe('⿺\u{2ECC}十')
  const counts = { named: 0, composed: 0, placed: 0, drawn: 0 }
  for (const { description, how } of table.values()) {
    counts[how]++
    // Each reads as the parser writes it back, and holds no compatibility ideograph.
    const read = parse(description)
    expect([...description].length === 1 || !read.problem && write(read.tree) === description).toBe(true)
    expect(description.normalize('NFC')).toBe(description)
  }
  expect(counts).toEqual({ named: 20, composed: 23890, placed: 1777, drawn: 4957 })
})
