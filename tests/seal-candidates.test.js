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

