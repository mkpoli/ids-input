import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCharacterInfo, characterScript } from '../src/adapter/character-info.js'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'
const document = JSON.parse(gunzipSync(readFileSync(new URL('../data/character-info.json.gz', import.meta.url))).toString())
const seal = JSON.parse(gunzipSync(readFileSync(new URL('../data/small-seal.json.gz', import.meta.url))).toString())
const info = createCharacterInfo(document, seal)

describe('sourced character meanings', () => {
  test('every compiled definition is reachable, including compatibility ideographs', () => {
    for (const char of Object.keys(document.entries)) expect(characterScript(char)).not.toBeNull()
    expect(info('車')?.glosses.length).toBeGreaterThan(0)
    for (const char of ['', '⿰', '木木', '🐎', 'A']) expect(info(char)).toBeNull()
  })
  test('dictionary qualifiers survive extraction', () => {
    expect(info('𗆮').glosses).toContain('(of a monarch) to die')
    expect(info('𗧅').glosses[0]).toStartWith('(imperial)')
    expect(info('𘘮').glosses[0]).toStartWith('(higher register)')
  })
  test('a component association stays distinct from a word gloss', () => {
    expect(info('𘥇').association).toBe('associated with horses')
    expect(info('𘥇').glosses).toEqual([])
    expect(info('𘆽').glosses).toContain('horse')
    expect(info('𘆽').relations).toContainEqual({char:'馬',kind:'han',meaning:'horse'})
    expect(info('馬').relations).toContainEqual({char:'𘆽',kind:'tangut',meaning:'horse'})
    expect(info('𘠀').association).toBeUndefined()
  })
  test('explicit Han mnemonics do not depend on dictionary punctuation', () => {
    for (const char of '水火山石土') expect(info(char).emoji.length).toBeGreaterThan(0)
    expect(info('馬').emoji).toContainEqual({text:'🐎',meaning:'horse'})
  })
  test('a Tangut character carries meanings in three languages and its readings', () => {
    const poison = info('𗀀')
    expect(poison.glosses).toContain('poison; venom; toxin')
    expect(poison.meanings.ja).toContain('毒。')
    expect(poison.meanings.zh).toContain('毒')
    expect(poison.readings.map(reading => reading.name)).toEqual([
      'Li Fanwen 2008', 'Gong Hwang-cherng', 'Gong Xun 2024-11', 'Arakawa Shintarō',
      'Marc Miyake', 'Nishida 1966', 'Kychanov 2006', 'Sofronov 1968',
    ])
    expect(poison.readings.find(reading => reading.name === 'Li Fanwen 2008').value).toBe('do1')
    expect(poison.soundGlosses.find(sound => sound.name === 'Li Fanwen').value).toContain('舌頭音')
  })
  test('a missing-explanation placeholder is not published as a meaning', () => {
    // Open Tangut writes 暫無解釋 where it has no Chinese explanation; the card says nothing instead.
    expect(document.entries['𗀦'].zh).toBeUndefined()
    expect(info('𗀦').meanings?.zh).toBeUndefined()
    expect(document.entries['𗆵'].zh).toEqual(['誠'])
    expect(info('𗆵').meanings.zh).toEqual(['誠'])
  })
  test('the Open Tangut records cover the ideographs and leave readings empty where none exist', () => {
    const tangut = Object.entries(document.entries).filter(([char]) => characterScript(char) === 'tangut')
    expect(tangut).toHaveLength(6144)
    expect(tangut.some(([, entry]) => entry.ja?.length)).toBe(true)
    expect(tangut.some(([, entry]) => entry.zh?.length)).toBe(true)
    expect(tangut.some(([, entry]) => entry.readings)).toBe(true)
    // A reading the source lacks stays out of the card, and an empty record still resolves.
    const noReading = tangut.find(([, entry]) => !entry.readings && entry.en.length)
    const found = info(noReading[0])
    expect(found.readings).toBeUndefined()
    expect(found.glosses.length + (found.meanings?.ja?.length ?? 0) + (found.meanings?.zh?.length ?? 0)).toBeGreaterThan(0)
  })
  test('a character lists each kind of source once', () => {
    // 馬 is glossed by Unihan, translated to Tangut by several Open Tangut records, and drawn in
    // small seal from two lists; the card shows each kind of source once.
    for (const char of ['馬', '鳥', '口', '𘥇']) {
      const kinds = info(char).sources.map(source => source.note)
      expect(new Set(kinds).size).toBe(kinds.length)
      expect(info(char).sourceSites).toEqual(kinds)
    }
    expect(info('馬').sources.map(source => source.note)).toEqual(['unihan', 'openTangut', 'sealSource', 'unicodeSealSource', 'editorial'])
  })
  test('an Open Tangut record links to the data it cites', () => {
    // A Tangut character's own record is in Open Tangut; a Han character's card names that record
    // where the translation comes from.
    expect(info('𘆽').sources.find(source => source.note === 'openTangut').url).toBe('https://github.com/imlooh/open-tangut')
    const han = info('馬').sources.find(source => source.note === 'openTangut')
    expect(han.url).toBe('https://github.com/imlooh/open-tangut')
  })
  test('sources the adapter adds for component examples keep their kind and appear once', async () => {
    // The adapter adds an Open Tangut record for each example and the Tangut IDS list after lookup.
    const adapter = babelStoneAdapter({ table: new Map([['𘆽', [{ text: '⿰𘥇𘨬', regions: '' }]]]), characterInfo: 'https://example.test/info.gz', fetch: async () => new Response(JSON.stringify(document)) })
    const found = await adapter.characterInfo('𘥇')
    const kinds = found.sources.map(source => source.note)
    expect(kinds).toContain('openTangut')
    expect(kinds).toContain('component')
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(found.sourceSites).toEqual(kinds)
    // The association and the list that describes the examples are two records, each linked once.
    expect(found.sources.find(source => source.note === 'component').url).toContain('TangutSea')
    expect(found.sources.find(source => source.note === 'tangutIds').url).toContain('TangutIDS.txt')
  })
  test('seal links have drawable coverage and both data-source credits', () => {
    const drawable = new Set([...Object.keys(seal.table), ...seal.parts.map(p=>p.part)])
    for (const char of Object.keys(document.entries)) for (const row of info(char).relations) if(row.kind==='seal') expect(drawable.has(row.char)).toBe(true)
    expect(info('馬').relations.some(r=>r.kind==='seal')).toBe(true)
    expect(info('馬').sources.some(s=>s.label.includes('SealSources'))).toBe(true)
    expect(info('皇').relations.some(r=>r.char==='\u{3D06C}')).toBe(false)
    expect(info('口').relations.some(r=>r.kind==='seal' && seal.modern[r.char]?.includes('𠙵'))).toBe(false)
  })
})

test('adapter loads meanings lazily, retries failures, and isolates cancellation', async () => {
  let calls=0
  const adapter=babelStoneAdapter({table:new Map([['𘆽',[{text:'⿰𘥇𘨬',regions:''}]]]),characterInfo:'https://example.test/info.gz',fetch:async()=>{
    calls++; if(calls===1) return new Response('',{status:503})
    return new Response(JSON.stringify(document))
  }})
  expect(calls).toBe(0)
  await expect(adapter.characterInfo('馬')).rejects.toThrow()
  const canceled=new AbortController(); canceled.abort()
  await expect(adapter.characterInfo('木',{signal:canceled.signal})).rejects.toThrow()
  const [horse,component]=await Promise.all([adapter.characterInfo('馬'),adapter.characterInfo('𘥇')])
  expect(calls).toBe(2)
  expect(horse.glosses[0]).toStartWith('horse;')
  expect(component.relations).toContainEqual({char:'𘆽',kind:'usage',meaning:'horse'})
  expect(babelStoneAdapter({table:new Map()}).characterInfo).toBeUndefined()
})
