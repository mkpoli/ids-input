// A variation sequence is described from the glyph GlyphWiki registers for it.
import { expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createDescriber, glyphName, rowsOf } from '../scripts/lib/variant-descriptions.mjs'
import { isOwnDescription, readVariantDescriptions } from '../src/core/variant-descriptions.js'
import { parse } from '../src/core/ids.js'

// Rows of GlyphWiki's dump of 2026-11-15: the glyphs of a few sequences and every glyph they place.
const rows = JSON.parse(await readFile(new URL('./fixtures/variant-glyphs.json', import.meta.url), 'utf8'))
const glyphs = new Map(Object.entries(rows).map(([name, [related, data]]) => [name, { related: /** @type {string} */ (related), data: /** @type {string} */ (data) }]))
const tables = { '突': ['⿱穴犬', '⿱⿱宀儿犬', '⿱⿱宀儿大'], '辻': ['⿺辶十'], '坪': ['⿰土平'], '旲': ['⿱日大'], '臭': ['⿱自犬', '⿱自大'], '葛': ['⿱艹曷'], '穴': ['⿱宀八'] }
const describe = createDescriber(glyphs, char => tables[/** @type {keyof typeof tables} */ (char)] ?? [], null, new Map([['\u{FA5E}', '艹\u{FE00}']]))
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

it('refers to the glyph of a form no notation writes', () => {
  expect(describe(sequence(0x845b, 0xe0100))?.description).toBe('⿱艹&GW-u66f7-var-002;')
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
    // A reference names a glyph; the rest reads as a description or one character.
    const plain = description.replace(/&GW-[^;]+;/g, '口')
    expect([...plain].length === 1 || !parse(plain).problem || /[{？]/.test(plain)).toBe(true)
  }
  expect(counts).toEqual({ named: 20, composed: 23743, placed: 2055, drawn: 4826 })
})
