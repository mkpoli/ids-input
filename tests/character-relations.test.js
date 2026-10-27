import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createRelationSearch } from '../src/adapter/character-relations.js'
import { babelStoneAdapter, parseIdsTable } from '../src/adapter/babelstone.js'
const read = name => gunzipSync(readFileSync(new URL(`../data/${name}`, import.meta.url))).toString()
const doc = JSON.parse(read('character-info.json.gz'))
const seal = JSON.parse(read('small-seal.json.gz'))
const table = parseIdsTable(read('babelstone-ids.tsv.gz'))
const index = createRelationSearch(doc, seal, table)
const chars = (query, limit=24) => index.search(query,{limit}).map(hit=>hit.char)
const horseSeal = Object.keys(seal.modern).find(char=>seal.modern[char].includes('馬') && (seal.table[char] || seal.parts.some(p=>p.part===char)))

describe('character relationships',()=>{
 test('English, emoji, Han and Tangut find the same recorded horse relations',()=>{
  for(const query of ['horse','🐎','馬','马','𘆽',horseSeal]) {
   const found=chars(query)
   for(const char of ['馬','马','𘆽','🐎',horseSeal]) expect(found,query).toContain(char)
  }
  for(const query of ['water','💧','水','𗋽']) for(const char of ['水','💧','𗋽']) expect(chars(query),query).toContain(char)
 })
 test('every glossed component occurrence is searchable in both directions',()=>{
  const component='𘠀'
  const words=Object.keys(doc.entries).filter(char=>doc.entries[char].source==='wiktionary' && table.get(char)?.some(s=>s.text.includes(component)))
  expect(words.length).toBeGreaterThan(4)
  for(const word of words) {
   expect(chars(component,1000)).toContain(word)
   expect(chars(word,1000)).toContain(component)
  }
  // Shared components never lead from one word to an unrelated word.
  const poison=chars('𗀀',1000)
  const components=new Set((table.get('𗀀')??[]).flatMap(s=>[...s.text]))
  const unrelated=Object.keys(doc.entries).filter(char=>char!=='𗀀' && doc.entries[char].source==='wiktionary' && table.get(char)?.some(s=>[...s.text].some(c=>components.has(c)&&c>='𘠀'&&c<='𘫿')))
  for(const word of unrelated)expect(poison).not.toContain(word)
 })
 test('qualified short meanings retain their full dictionary labels',()=>{
  expect(index.search('die').find(h=>h.char==='𗆮')?.label).toBe('(of a monarch) to die')
  expect(index.search('short').find(h=>h.char==='𗅒')?.label).toBe('(of stature) short')
  expect(index.search('午').find(h=>h.char==='𘆽')?.label).toContain('Chinese 午')
 })
 test('presentation selectors, literal priority, uniqueness and limits',()=>{
  for(const query of ['☀','☀️','☀︎']) expect(chars(query)).toContain('日')
  expect(chars('車')[0]).toBe('車')
  expect(chars('馬')[0]).toBe('馬')
  expect(chars('horse',0)).toEqual([])
  expect(chars(' ')).toEqual([])
  const found=chars('horse',7)
  expect(found).toHaveLength(7);expect(new Set(found).size).toBe(7)
 })
 test('drawable Small Seal links keep direct correspondences separate from lookup aliases',()=>{
  const drawable=new Set([...Object.keys(seal.table),...seal.parts.map(p=>p.part)])
  for(const hit of index.search('horse',{limit:1000}))if(hit.char.codePointAt(0)>=0x3d000)expect(drawable.has(hit.char)).toBe(true)
  expect(chars('皇',1000)).not.toContain('\u{3D06C}')
  const mouth=Object.keys(seal.modern).find(c=>seal.modern[c].includes('𠙵')&&seal.modern[c].includes('口'))
  expect(chars('口',1000)).not.toContain(mouth)
 })
 test('a matched sense does not expand a different meaning of the same glyph',()=>{
  const fixture={format:'ids-character-info-1',entries:{'木':{en:['tree; wood'],source:'unihan',aids:[0,1]},'𗀀':{en:['tree'],source:'wiktionary',aids:[0]},'𗀁':{en:['wood'],source:'wiktionary',aids:[1]}},aids:[{en:['tree'],han:['木'],emoji:'🌳'},{en:['wood'],han:['木'],emoji:'🪵'}],components:{}}
  const search=createRelationSearch(fixture,null,new Map())
  expect(search.search('tree').map(h=>h.char)).not.toContain('𗀁')
  expect(search.search('木').map(h=>h.char)).toEqual(expect.arrayContaining(['𗀀','𗀁']))
 })
})

test('both adapter searches use relations while retaining readings and isolating cancellation',async()=>{
 let calls=0
 const adapter=babelStoneAdapter({table,smallSeal:seal,characterInfo:'https://example.test/info',namesText:'uma\t馬\ttest\n',charactersText:'mǎ\t馬\ttest\n',fetch:async()=>{calls++;return new Response(JSON.stringify(doc))}})
 expect(calls).toBe(0)
 for(const method of ['search','searchCharacters']){
  for(const query of ['horse','🐎','𘆽','馬']) expect((await adapter[method](query)).map(h=>h.char)).toContain(horseSeal)
  const c=new AbortController();c.abort()
  await expect(adapter[method]('horse',{signal:c.signal})).rejects.toThrow()
 }
 expect((await adapter.search('uma')).map(h=>h.char)).toContain('𘆽')
 expect((await adapter.searchCharacters('mǎ')).map(h=>h.char)).toContain('𘆽')
 expect(calls).toBe(1)
})

test('failed relation loads retry, and canceled readers do not poison a shared load',async()=>{
 let calls=0,release
 const adapter=babelStoneAdapter({table,characterInfo:'https://example.test/info',fetch:async()=>{calls++;if(calls===1)return new Response('',{status:503});await new Promise(r=>release=r);return new Response(JSON.stringify(doc))}})
 await expect(adapter.search('horse')).rejects.toThrow()
 const canceled=new AbortController()
 const one=adapter.search('horse',{signal:canceled.signal}),two=adapter.searchCharacters('horse')
 canceled.abort();await new Promise(r=>setTimeout(r,0));release()
 await expect(one).rejects.toThrow();expect((await two).some(h=>h.char==='𘆽')).toBe(true)
 expect(calls).toBe(2)
})

test('adapter coverage, labelled lookup/usage links, forms, and cross-script ranking',async()=>{
 const adapter=babelStoneAdapter({table,smallSeal:seal,characterInfo:doc,formsText:readFileSync(new URL('../data/component-forms.tsv',import.meta.url),'utf8'),charactersText:read('character-vocabulary.tsv.gz')})
 for(const method of ['search','searchCharacters']){
  expect((await adapter[method]('皇',{limit:1000})).map(h=>h.char)).not.toContain('\u{3D06C}')
  const mouth=Object.keys(seal.modern).find(c=>seal.modern[c].includes('𠙵')&&seal.modern[c].includes('口')&&(seal.table[c]||seal.parts.some(p=>p.part===c)))
  expect((await adapter[method]('口',{limit:1000})).find(h=>h.char===mouth)?.label).toStartWith('lookup')
  expect((await adapter[method](mouth,{limit:1000})).find(h=>h.char==='口')?.label).toStartWith('lookup')
  const water=await adapter[method]('water',{limit:1000})
  expect(water.find(h=>h.char==='𘠣')?.label).toStartWith('component of ')
  const fish=await adapter[method]('fish')
  expect(fish.map(h=>h.char)).toEqual(expect.arrayContaining(['魚','𗋾','🐟']))
  expect((await adapter[method]('tree')).some(h=>seal.modern[h.char]?.includes('木'))).toBe(true)
  expect((await adapter[method]('氵')).map(h=>h.char)).toContain('𗋽')
 }
 const onlyMeanings=babelStoneAdapter({characterInfo:doc})
 expect((await onlyMeanings.search('water')).map(h=>h.char)).toContain('𗋽')
 expect((await onlyMeanings.characterInfo('𘥇')).association).toBe('associated with horses')
 expect(index.search('die',{limit:1000}).find(h=>h.label.startsWith('component of 𗆮'))?.label).toContain('(of a monarch) to die')
})

test('relation-source failure preserves unique bounded character results',async()=>{
 const adapter=babelStoneAdapter({charactersText:'馬\t馬\ttest\n',characterInfo:'https://example.test/missing',fetch:async()=>new Response('',{status:503})})
 expect(await adapter.searchCharacters('馬',{limit:1})).toHaveLength(1)
 expect((await adapter.searchCharacters('馬',{limit:10})).map(h=>h.char)).toEqual(['馬'])
 expect(await adapter.searchCharacters('馬',{limit:0})).toEqual([])
})
