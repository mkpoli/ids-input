import { expect, it } from 'bun:test'
import { createSealCandidates } from '../scripts/lib/seal-candidates.js'
import { readForms } from '../src/core/search.js'
const [head, wood, variant, water] = [0x3D100, 0x3D101, 0x3D102, 0x3D103].map(cp => String.fromCodePoint(cp))
const doc = { format: 1, table: { [head]: [`⿰${wood}${wood}`] }, modern: { [head]: ['林'], [wood]: ['木'], [variant]: ['木'], [water]: ['水'] }, parts: [], records: [{char:head,id:'source-1', descriptions:[{original:'⿰&wood;&wood;',status:'unresolved'}]}], sources:[{revision:'pinned'}] }
const table = new Map([['林', [{text:'⿰木木',regions:'G'},{text:'⿱木木',regions:'T'}]]])
const engine = createSealCandidates(doc, table)

it('retains alternatives, repeated-component consistency, regional evidence and original records', () => {
  const result = engine.compare(head)
  expect(result.candidates.map(c => c.text)).toEqual([`⿰${wood}${wood}`, `⿱${wood}${wood}`, `⿰${variant}${variant}`, `⿱${variant}${variant}`])
  expect(result.candidates[0].mappings[0].options).toEqual([wood,variant])
  expect(result.candidates[0].regions).toBe('G')
  expect(result.records).toEqual(doc.records)
  expect(result.attested).toEqual(doc.table[head])
  expect(result.truncated).toBe(false)
})

it('marks missing mappings as slots and records radical-fold provenance', () => {
  const result = createSealCandidates(doc, new Map([['林',[{text:'⿰氵龘',regions:''}]]]), readForms('氵\t水')).compare(head)
  expect(result.candidates[0].text).toBe(`⿰${water}⬚`)
  expect(result.candidates[0].unmapped).toEqual(['龘'])
  expect(result.candidates[0].mappings.map(m => m.via)).toEqual(['radical-form','unmapped'])
})

it('bounds combinations, reports truncation and gives different modern descriptions a turn', () => {
  const result = engine.compare(head, 2)
  expect(result.candidates.map(c=>c.modernIds)).toEqual(['⿰木木','⿱木木'])
  expect(result.truncated).toBe(true)
  expect(engine.compare(head, NaN).candidates).toHaveLength(4)
})

it('does not substitute a head for its own component or guess unsupported modern IDS', () => {
  const d = {...doc, modern:{...doc.modern,[head]:['林','木']}}
  const r = createSealCandidates(d,new Map([['林',[{text:'⿰木{123}',regions:''},{text:'林',regions:''}]],['木',[{text:'⿰木木',regions:''}]]])).compare(head)
  expect(r.modernDescriptions.filter(m=>!m.supported)).toHaveLength(2)
  expect(r.candidates.every(c=>!c.text.includes(head))).toBe(true)
})

it('identifies unavailable reference and component glyphs', () => {
  const c=createSealCandidates({...doc,table:{},parts:[{part:wood,kind:'seal'}]},table).compare(head)
  expect(c.glyphAvailable).toBe(false)
  expect(c.candidates[0].missingGlyphs).toEqual([])
  expect(c.candidates[2].missingGlyphs).toEqual([variant])
})

it('expands unmapped components recursively and reuses choices across repeated occurrences', () => {
  const source = new Map([
    ['林', [{text:'⿰𤇾𤇾',regions:'G'}]],
    ['𤇾', [{text:'⿱炏水',regions:'T'}]],
    ['炏', [{text:'⿰木木',regions:'J'}]],
  ])
  const r=createSealCandidates(doc,source).compare(head)
  expect(r.candidates).toHaveLength(2)
  expect(r.candidates[0].text).toBe(`⿰⿱⿰${wood}${wood}${water}⿱⿰${wood}${wood}${water}`)
  expect(r.candidates[0].expansions).toEqual([{component:'𤇾',ids:'⿱炏水',regions:'T'},{component:'炏',ids:'⿰木木',regions:'J'}])
  expect(r.candidates.every(c=>!c.unmapped.length)).toBe(true)
  expect(r.truncated).toBe(false)
  expect(doc.table[head]).toEqual([`⿰${wood}${wood}`])
})

it('keeps direct seal mappings atomic even when modern decompositions are available', () => {
  const r=createSealCandidates(doc,new Map([...table,['木',[{text:'⿱十人'}]]])).compare(head)
  expect(r.candidates[0].expansions).toEqual([])
  expect(r.candidates[0].text).toBe(`⿰${wood}${wood}`)
})

it('terminates cyclic decompositions with an explicit unmapped component', () => {
  const r=createSealCandidates(doc,new Map([
    ['林',[{text:'⿰甲木'}]], ['甲',[{text:'⿱乙水'}]], ['乙',[{text:'⿰甲木'}]],
  ])).compare(head)
  expect(r.candidates.length).toBeGreaterThan(0)
  expect(r.candidates.every(c=>c.unmapped.includes('甲') && c.text.includes('⬚'))).toBe(true)
  expect(r.candidates[0].expansions).toHaveLength(2)
})

it('bounds oversized recursive expansions and marks the result as limited', () => {
  const chars=[...'甲乙丙丁戊己庚辛壬癸']
  const source=new Map([['林',[{text:'⿰甲甲'}]],...chars.map((c,i)=>[c,[{text:i+1<chars.length?`⿰${chars[i+1]}${chars[i+1]}`:'⿰木木'}]])])
  const r=createSealCandidates(doc,source).compare(head)
  expect(r.truncated).toBe(true)
  expect(r.candidates.length).toBeGreaterThan(0)
  expect(r.candidates.every(c=>[...c.text].length<=64)).toBe(true)
})

it('retains alternative nested descriptions with their regions', () => {
  const r=createSealCandidates(doc,new Map([
    ['林',[{text:'⿰甲甲'}]], ['甲',[{text:'⿰木水',regions:'G'},{text:'⿱水木',regions:'T'}]],
  ])).compare(head)
  expect(r.candidates.map(c=>c.expansions[0].regions)).toEqual(['G','T','G','T'])
  expect(r.candidates[0].text).toBe(`⿰⿰${wood}${water}⿰${wood}${water}`)
  expect(r.candidates[1].text).toBe(`⿰⿱${water}${wood}⿱${water}${wood}`)
})
it('gives other root descriptions a turn before additional nested alternatives', () => {
  const r=createSealCandidates(doc,new Map([
    ['林',[{text:'⿰甲木',regions:'G'},{text:'⿱水木',regions:'T'}]],
    ['甲',[{text:'⿰木水'},{text:'⿱木水'},{text:'⿱水木'}]],
  ])).compare(head,2)
  expect(r.candidates.map(c=>c.regions)).toEqual(['G','T'])
  expect(r.truncated).toBe(true)
})
it('resolves the bundled 禜 component 𤇾 through 炏 into mapped seal leaves', async () => {
  const {readFileSync}=await import('node:fs'),{gunzipSync}=await import('node:zlib')
  const {parseIdsTable,mergeIdsTables}=await import('../src/adapter/babelstone.js')
  const read=name=>gunzipSync(readFileSync(new URL('../data/'+name,import.meta.url))).toString()
  const seal=JSON.parse(read('small-seal.json.gz'))
  const modern=mergeIdsTables(parseIdsTable(read('babelstone-ids.tsv.gz')),parseIdsTable(read('yi-bai-ids.tsv.gz')))
  const folds=readForms(readFileSync(new URL('../data/component-forms.tsv',import.meta.url),'utf8'))
  const r=createSealCandidates(seal,modern,folds).compare(String.fromCodePoint(0x3D048))
  const nested=r.candidates.find(c=>!c.unmapped.length)
  expect(nested.expansions.map(e=>[e.component,e.ids])).toEqual([['𤇾','⿱炏冖'],['炏','⿰火火']])
  expect(nested.text).toBe('⿱⿱⿰𾳜𾳜𾖷𽀒')
  expect(nested.missingGlyphs).toEqual([])
})
