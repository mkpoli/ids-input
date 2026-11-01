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
  test('a character lists each kind of source once', () => {
    // 馬 is glossed by Unihan, translated to Tangut by several Wiktionary records, and drawn in
    // small seal from two lists; the card shows each kind of source once.
    for (const char of ['馬', '鳥', '口', '𘥇']) {
      const kinds = info(char).sources.map(source => source.note)
      expect(new Set(kinds).size).toBe(kinds.length)
      expect(info(char).sourceSites).toEqual(kinds)
    }
    expect(info('馬').sources.map(source => source.note)).toEqual(['unihan', 'wiktionary', 'sealSource', 'unicodeSealSource', 'editorial'])
  })
  test('a Wiktionary record links to a page that carries what it cites', () => {
    // A Tangut character's own page has its glosses; a Han character's Wiktionary record says where
    // its Tangut translation comes from, and a Tangut page would be no use to the reader.
    expect(info('𘆽').sources.find(source => source.note === 'wiktionary').url).toContain(encodeURIComponent('𘆽'))
    const han = info('馬').sources.find(source => source.note === 'wiktionary')
    expect(han.url).toBe('https://en.wiktionary.org/wiki/Main_Page')
  })
  test('sources the adapter adds for component examples keep their kind and appear once', async () => {
    // The adapter adds a Wiktionary record for each example and the Tangut IDS list after lookup.
    const adapter = babelStoneAdapter({ table: new Map([['𘆽', [{ text: '⿰𘥇𘨬', regions: '' }]]]), characterInfo: 'https://example.test/info.gz', fetch: async () => new Response(JSON.stringify(document)) })
    const found = await adapter.characterInfo('𘥇')
    const kinds = found.sources.map(source => source.note)
    expect(kinds).toContain('wiktionary')
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
