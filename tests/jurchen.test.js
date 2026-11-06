import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { isComponent, isJurchen, isLetter, parse, write } from '../src/core/ids.js'
import { characterScript, groupPaletteParts, isOtherScript, partScript } from '../src/core/scripts.js'
import { compose } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { hasJurchen, jurchenSource } from '../src/composer/jurchen.js'
import { traitsOf } from '../src/composer/source.js'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'
import { jurchenAdapter } from '../src/adapter/jurchen.js'
import { characterOf, namedFor } from '../worker/render.js'
import { codePoint } from '../worker/card.js'
import { codePoint as pageCodePoint } from '../worker/page.js'
import { load as loadSearchWorker, recovered } from '../src/adapter/search-worker.js'
import { jurchenLabel, jurchenMatches, jurchenNames } from '../src/adapter/jurchen-data.js'

const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/jurchen.json.gz', import.meta.url))).toString())
const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/jurchen-outlines.json.gz', import.meta.url))).toString())
const chars = data.parts.filter(part => part.jurGroup === 'character')
const radicals = data.parts.filter(part => part.jurGroup === 'radical')
const FIRST = '\u{18E00}', TUMEN = '\u{18E01}', VARIANT = '\u{18E01}\uFE00', RADICAL = '\u{191A0}'
const found = query => jurchenMatches(data.parts, query).map(part => part.part)

describe('Jurchen data', () => {
  it('holds the whole of Unicode 18.0, once each', () => {
    expect(chars).toHaveLength(914)
    expect(radicals).toHaveLength(51)
    expect(new Set(data.parts.map(part => part.part)).size).toBe(1502)
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
    expect(Object.keys(outlines.records)).toHaveLength(1502)
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
    expect(groupPaletteParts(data.parts).get('jurchen')).toHaveLength(1502)
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
    expect(await adapter.parts()).toHaveLength(1502)
    expect((await adapter.search(TUMEN)).map(hit => hit.char)).toContain(TUMEN)
  })

  it('returns as many characters of a stroke code as the search asks for', async () => {
    const adapter = jurchenAdapter({ data, palette: [] })
    expect((await adapter.search('szhhd', { limit: 120 })).filter(hit => isJurchen(hit.char))).toHaveLength(data.parts.filter(part => part.jurCode === 'szhhd').length)
    expect(data.parts.filter(part => part.jurCode === 'szhhd').length).toBeGreaterThan(12)
  })

  it('keeps the other hits when the Jurchen index cannot be read', async () => {
    const adapter = babelStoneAdapter({ palette: [], table: new Map(), jurchen: 'https://example.invalid/jurchen.json.gz', fetch: async () => { throw new Error('offline') } })
    expect((await adapter.search(TUMEN)).map(hit => hit.char)).toContain(TUMEN)
  })
})

describe('Jurchen variant sequences', () => {
  const variants = data.parts.filter(part => part.jurGroup === 'variant')

  it('holds the 537 of the table, each after its base with its record', () => {
    expect(variants).toHaveLength(537)
    for (const variant of variants) {
      const [base, selector] = [...variant.part]
      expect(selector >= '\uFE00' && selector <= '\uFE04').toBe(true)
      const entry = chars.find(part => part.part === base)
      expect(variant.jurReading).toBe(entry.jurReading)
    }
    const at = data.parts.findIndex(part => part.part === TUMEN)
    expect(data.parts[at + 1].part).toBe(VARIANT)
  })

  it('draws each one from its own outline', async () => {
    expect(outlines.records[VARIANT].G.p).not.toEqual(outlines.records[TUMEN].G.p)
    expect(onlyBundled(`⿰${VARIANT}${FIRST}`, false, false)).toBe(true)
    expect(onlyBundled(`⿰${TUMEN}\uFE04${FIRST}`, false, false)).toBe(false)
    const drawn = await compose(jurchenSource({ load: async () => outlines }), `⿰${VARIANT}${FIRST}`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${VARIANT}`)
  })

  it('puts a typed variant first in the adapter search', async () => {
    const adapter = jurchenAdapter({ data, palette: [] })
    expect((await adapter.search(VARIANT, { limit: 1 })).map(hit => hit.char)).toEqual([VARIANT])
  })

  it('names a variant on a share card', async () => {
    expect(namedFor(VARIANT, VARIANT)).toBe(VARIANT)
    expect(await characterOf({}, VARIANT)).toBe(VARIANT)
    expect(codePoint(VARIANT)).toBe('U+18E01 U+FE00')
    expect(codePoint(TUMEN)).toBe('U+18E01')
    expect(pageCodePoint(VARIANT)).toBe('U+18E01 U+FE00')
  })

  it('keeps a typed variant in the search and in a description', () => {
    expect(jurchenNames(data, VARIANT)[0].char).toBe(VARIANT)
    expect(write(parse(`⿰${VARIANT}${FIRST}`).tree)).toBe(`⿰${VARIANT}${FIRST}`)
    expect(jurchenLabel(variants[0])).toContain('女真 異體')
    expect(jurchenLabel(variants[0])).toContain('U+18E01 U+FE00')
  })
})

describe('Jurchen editorial descriptions', () => {
  const built = data.parts.filter(part => part.ids)
  const SAMPLE = '\u{18F6A}', TOP = '\u{191BA}', BOTTOM = '\u{191C8}'

  it('holds the 44 of ids.json, each two parts of the block', () => {
    expect(built).toHaveLength(44)
    expect(data.ids.count).toBe(44)
    expect(data.ids.note.length).toBeGreaterThan(0)
    const known = new Set(data.parts.map(part => part.part))
    for (const part of built) {
      expect(part.jurGroup).toBe('character')
      const [op, ...rest] = [...part.ids]
      expect(['⿰', '⿱', '⿷', '⿸']).toContain(op)
      expect(rest).toHaveLength(2)
      expect(rest.every(char => known.has(char) && char !== part.part)).toBe(true)
    }
    expect(data.parts.find(part => part.part === SAMPLE).ids).toBe(`⿱${TOP}${BOTTOM}`)
    // A dot held in a corner names the character that holds it first.
    expect(data.parts.find(part => part.part === '\u{18EB9}').ids).toBe('⿸\u{191A8}\u{191D0}')
    expect(data.parts.find(part => part.part === '\u{18E7A}').ids).toBe('⿷\u{18E75}\u{191D0}')
  })

  it('reads them as descriptions, found by their parts', async () => {
    const adapter = jurchenAdapter({ data, palette: [] })
    expect((await adapter.table()).get(SAMPLE)).toEqual([{ text: `⿱${TOP}${BOTTOM}`, regions: '' }])
    expect((await adapter.containing(TOP + BOTTOM)).items).toContain(SAMPLE)
    expect((await adapter.findByIds(TOP)).hits.map(hit => hit.char)).toContain(SAMPLE)
  })

  it('finds a character by its description, ahead of its parts', async () => {
    expect(found(`⿱${TOP}${BOTTOM}`)).toEqual([SAMPLE])
    expect(found(TOP)[0]).toBe(TOP)
    expect(found(TOP)).toContain(SAMPLE)
    const adapter = jurchenAdapter({ data, palette: [] })
    expect((await adapter.search(`⿱${TOP}${BOTTOM}`))[0].char).toBe(SAMPLE)
    expect(jurchenLabel(data.parts.find(part => part.part === SAMPLE))).toContain(`⿱${TOP}${BOTTOM}`)
  })

  it('carries them into the search worker, and survives a missing file', async () => {
    const parts = [{ part: SAMPLE, ids: `⿱${TOP}${BOTTOM}` }, { part: TOP, ids: null }, { part: BOTTOM, ids: null }]
    const args = ['data:text/plain,', undefined, undefined, '', undefined, '', undefined, '', undefined, undefined]
    const search = await loadSearchWorker(...args, { format: 1, parts })
    expect(search.search(TOP, { limit: 3 }).hits.map(hit => hit.char)).toEqual([SAMPLE])
    const other = await loadSearchWorker(...args, { format: 2, parts: [] })
    expect(other.search(TOP, { limit: 3 }).hits).toEqual([])
  })

  it('notices when a file the worker search went without comes back', async () => {
    const good = Buffer.from(JSON.stringify({ format: 1, parts: [] })).toString('base64')
    const realFetch = globalThis.fetch
    let up = false
    globalThis.fetch = async (url, init) => String(url).endsWith('jurchen')
      ? (up ? new Response(Buffer.from(good, 'base64')) : new Response('', { status: 404 })) : realFetch(url, init)
    try {
      await loadSearchWorker('data:text/plain,', undefined, undefined, '', undefined, '', undefined, '', undefined, undefined, 'https://example.invalid/jurchen')
      expect(await recovered()).toBe(false)
      up = true
      expect(await recovered()).toBe(true)
    } finally { globalThis.fetch = realFetch }
  })
})

describe('Finding Jurchen', () => {
  it('finds a code point, written either way', () => {
    expect(found('U+18E01')[0]).toBe(TUMEN)
    expect(found('18e01')[0]).toBe(TUMEN)
    expect(found('U+18E01').every(char => char.startsWith(TUMEN))).toBe(true)
    expect(found('U+10000')).toEqual([])
  })

  it('reads a number as a value, then a stroke count', () => {
    expect(found('10000')[0]).toBe(TUMEN)
    expect(found('10000').every(char => char.startsWith(TUMEN))).toBe(true)
    const five = found('5')
    expect(data.parts.find(part => part.part === five[0]).jurNumeric).toBe(5)
    expect(five.length).toBeGreaterThan(1)
    expect(five.slice(1).every(char => data.parts.find(part => part.part === char).strokes === 5)).toBe(true)
  })

  it('lists typed characters in order', () => {
    expect(found(TUMEN + FIRST)).toEqual([TUMEN, FIRST])
    expect(found(`${VARIANT}${FIRST}`)).toEqual([VARIANT, FIRST])
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
