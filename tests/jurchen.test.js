import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { isComponent, isJurchen, isLetter, parse, write } from '../src/core/ids.js'
import { characterScript, groupPaletteParts, isOtherScript, partScript } from '../src/core/scripts.js'
import { compose } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { hasJurchen, jurchenSource } from '../src/composer/jurchen.js'
import { traitsOf } from '../src/composer/source.js'
import { jurchenAdapter } from '../src/adapter/jurchen.js'
import { jurchenLabel, jurchenMatches, jurchenNames } from '../src/adapter/jurchen-data.js'

const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/jurchen.json.gz', import.meta.url))).toString())
const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/jurchen-outlines.json.gz', import.meta.url))).toString())
const chars = data.parts.filter(part => part.jurGroup === 'character')
const radicals = data.parts.filter(part => part.jurGroup === 'radical')
const FIRST = '\u{18E00}', TUMEN = '\u{18E01}', RADICAL = '\u{191A0}'
const found = query => jurchenMatches(data.parts, query).map(part => part.part)

describe('Jurchen data', () => {
  it('holds the whole of Unicode 18.0, once each', () => {
    expect(chars).toHaveLength(914)
    expect(radicals).toHaveLength(51)
    expect(new Set(data.parts.map(part => part.part)).size).toBe(965)
    expect(chars.map(part => part.part.codePointAt(0))).toEqual(Array.from({ length: 914 }, (_, i) => 0x18E00 + i))
    expect(radicals.map(part => part.part.codePointAt(0))).toEqual(Array.from({ length: 51 }, (_, i) => 0x191A0 + i))
  })

  it('keeps the records of JurchenSources.txt', () => {
    expect(chars[1]).toMatchObject({ part: TUMEN, jurRadical: 1, strokes: 3, jurSource: 'NC:002.04', jurReading: 'tumən', jurNumeric: 10000 })
    expect(chars.filter(part => part.jurReading)).toHaveLength(806)
    expect(chars.filter(part => part.jurNumeric !== null)).toHaveLength(30)
    expect(chars.every(part => part.jurRadical >= 1 && part.jurRadical <= 51 && part.strokes > 0)).toBe(true)
    expect(radicals.every((part, index) => part.jurRadical === index + 1 && part.strokes === null)).toBe(true)
  })

  it('gives every part a stroke code', () => {
    expect(data.parts.every(part => /^[hspdz]+b?$/.test(part.jurCode))).toBe(true)
    expect(chars[0].jurCode).toBe('hhz')
    expect(radicals.every(part => part.jurCode.endsWith('b'))).toBe(true)
  })

  it('draws every part, with quadratic outlines only', () => {
    expect(Object.keys(outlines.records)).toHaveLength(965)
    for (const part of data.parts) {
      const record = outlines.records[part.part]
      expect(record.G.p.length).toBeGreaterThan(0)
      expect(record.G.p.every(([ops]) => /^M(?:L|Q2)*$/.test(ops))).toBe(true)
    }
  })
})

describe('Jurchen in the editor', () => {
  it('reads the block as components of its own script, and nothing outside it', () => {
    for (const char of [FIRST, '\u{19191}', RADICAL, '\u{191D2}']) {
      expect(isJurchen(char)).toBe(true)
      expect(isComponent(char)).toBe(true)
      expect(isLetter(char)).toBe(false)
      expect(characterScript(char)).toBe('jurchen')
      expect(write(parse(`⿰${char}木`).tree)).toBe(`⿰${char}木`)
    }
    for (const point of [0x18DFF, 0x19192, 0x1919F, 0x191D3]) expect(isJurchen(String.fromCodePoint(point))).toBe(false)
    expect(partScript(`⿰${FIRST}${TUMEN}`)).toBe('jurchen')
    expect(partScript(`⿰${FIRST}木`)).toBe('mixed')
  })

  it('has its own tab and stays out of Other scripts', () => {
    expect(isOtherScript('jurchen')).toBe(false)
    expect(groupPaletteParts(data.parts).get('jurchen')).toHaveLength(965)
  })

  it('draws a description of Jurchen from the bundled outlines', async () => {
    const sequence = `⿰${FIRST}${TUMEN}`
    expect(hasJurchen(sequence)).toBe(true)
    expect(traitsOf(sequence).jurchen).toBe(true)
    expect(onlyBundled(sequence, false, false)).toBe(true)
    const drawn = await compose(jurchenSource({ load: async () => outlines }), sequence, { separate: true })
    expect(drawn.origins).toContain(`glyph ${FIRST}`)
    expect(drawn.d.length).toBeGreaterThan(10)
  })

  it('adds the parts to the palette and a reading to the search', async () => {
    const adapter = jurchenAdapter({ data, palette: [] })
    expect(await adapter.parts()).toHaveLength(965)
    expect((await adapter.search(TUMEN)).map(hit => hit.char)).toContain(TUMEN)
  })
})

describe('Finding Jurchen', () => {
  it('finds a code point, written either way', () => {
    expect(found('U+18E01')).toEqual([TUMEN])
    expect(found('18e01')).toEqual([TUMEN])
    expect(found('U+10000')).toEqual([])
  })

  it('reads a number as a value, then a stroke count', () => {
    const hits = found('10000')
    expect(hits).toEqual([TUMEN])
    const five = found('5')
    expect(data.parts.find(part => part.part === five[0]).jurNumeric).toBe(5)
    expect(five.length).toBeGreaterThan(1)
    expect(five.slice(1).every(char => data.parts.find(part => part.part === char).strokes === 5)).toBe(true)
  })

  it('lists typed characters in order', () => {
    expect(found(TUMEN + FIRST)).toEqual([TUMEN, FIRST])
  })

  it('finds a stroke code, whole before its extensions', () => {
    expect(found('hhz')[0]).toBe(FIRST)
    expect(found('HHZ')[0]).toBe(FIRST)
    expect(found('hh').length).toBeGreaterThan(1)
  })

  it('finds a reading in its own letters and in plain ones', () => {
    expect(found('tumən')[0]).toBe(TUMEN)
    expect(found('tumen')[0]).toBe(TUMEN)
    expect(found('shan')).toContain('\u{18E03}')
    expect(found('ʃan')).toContain('\u{18E03}')
    expect(found('qqqq')).toEqual([])
  })

  it('names a part with its record', () => {
    const label = jurchenLabel(chars[1])
    for (const text of ['女真 字', 'tumən', '10000', 'hpz', '部首 1', '3 畫', 'NC:002.04', 'U+18E01']) expect(label).toContain(text)
    expect(jurchenLabel(radicals[0])).toContain('女真 部首')
  })

  it('ranks a reading in the search below a typed character', () => {
    expect(jurchenNames(data, TUMEN)[0]).toEqual({ char: TUMEN, label: jurchenLabel(chars[1]) })
    expect(jurchenNames(data, 'tumen')[0].rank).toBe(5)
    expect(jurchenNames(data, '')).toEqual([])
    expect(jurchenNames(data, '10000')[0].char).toBe(TUMEN)
    expect(jurchenNames(data, '10001')).toEqual([])
  })

  it('names and finds a host part with no record', () => {
    const bare = { part: FIRST, kind: 'extra' }
    expect(jurchenLabel(bare)).toBe('女真 字 · U+18E00')
    expect(jurchenMatches([bare], 'hh')).toEqual([])
    expect(groupPaletteParts([bare]).get('jurchen')).toEqual([bare])
  })
})
