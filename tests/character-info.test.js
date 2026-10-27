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
