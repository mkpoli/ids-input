import { expect, it } from 'bun:test'
import { createSealCandidates } from '../src/adapter/seal-candidates.js'
import { smallSealAdapter } from '../src/adapter/small-seal.js'
import { readForms } from '../src/core/search.js'
import { makeReview, readReviews, persistReview, exportReviews, validReviewIds, SEAL_REVIEW_KEY } from '../demo/lib/seal-reviews.js'
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
  expect(validReviewIds(result.candidates[0].text, head)).toBe(false)
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

it('offers adapter lookup by either script or code point without changing exact structures', async () => {
  const adapter = smallSealAdapter({data:doc,table,palette:[]})
  for (const query of ['林',head,'U+3D100']) {
    const result=await adapter.sealReview(query)
    expect(result.items[0].char).toBe(head)
    expect(result.items[0].candidates).toHaveLength(4)
  }
  expect((await adapter.sealReview('U+FFFFFF')).items).toEqual([])
  expect((await adapter.sealReview('')).items).toEqual([])
  expect(await adapter.sealReview('林', {limit:0})).toEqual({items:[],total:1})
  expect(await adapter.structure(head)).toEqual([{text:doc.table[head][0],regions:''}])
  expect(await adapter.encoded(`⿱${wood}${wood}`)).toEqual([])
  const controller=new AbortController();controller.abort()
  await expect(adapter.sealReview('林',{signal:controller.signal})).rejects.toThrow()
})

it('accepts corrected complete IDS and exports source evidence separately from attested data', () => {
  const comparison=engine.compare(head), candidate=comparison.candidates[0]
  const corrected=`⿱${wood}${variant}`
  const review=makeReview(comparison,candidate,corrected,'Compared with source image','accepted','2026-10-27T00:00:00Z')
  expect(review.candidate.text).toBe(doc.table[head][0])
  expect(review.text).toBe(corrected)
  expect(review.evidence.records).toEqual(doc.records)
  expect(readReviews(exportReviews([review]))).toEqual([review])
  expect(doc.table[head]).toEqual([`⿰${wood}${wood}`])
  for (const text of ['木','⿰木⬚','⿰木？',`⿰木${head}`,'⿰木']) expect(()=>makeReview(comparison,candidate,text,'','accepted')).toThrow()
  expect(makeReview(comparison,candidate,'⿰木⬚','','rejected').decision).toBe('rejected')
})

it('merges decisions with other tabs and surfaces damaged storage or quota failures', () => {
  const comparison=engine.compare(head)
  const one=makeReview(comparison,comparison.candidates[0],comparison.candidates[0].text,'','accepted')
  const two=makeReview(comparison,comparison.candidates[1],comparison.candidates[1].text,'','rejected')
  const entries=new Map([[SEAL_REVIEW_KEY,exportReviews([one])]])
  const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)}
  expect(persistReview(storage,[],two)).toHaveLength(2)
  expect(readReviews(storage.getItem(SEAL_REVIEW_KEY))).toHaveLength(2)
  entries.set(SEAL_REVIEW_KEY,'broken')
  expect(()=>persistReview(storage,[],two)).toThrow()
  expect(entries.get(SEAL_REVIEW_KEY)).toBe('broken')
  expect(()=>persistReview({getItem:()=>null,setItem:()=>{throw new Error('quota')}},[],one)).toThrow('quota')
})

it('rejects unknown and self-referencing components carrying variation selectors', () => {
  expect(validReviewIds('⿰木？\uFE00', head)).toBe(false)
  expect(validReviewIds(`⿰木${head}\uFE00`, head)).toBe(false)
})

it('keeps a newer unsaved decision when a different review is saved later', () => {
  const c=engine.compare(head), a=c.candidates[0], b=c.candidates[1]
  const old=makeReview(c,a,a.text,'old','accepted','2026-10-27T00:00:00Z')
  const pending=makeReview(c,a,a.text,'new','rejected','2026-10-27T00:01:00Z')
  const next=makeReview(c,b,b.text,'other','accepted','2026-10-27T00:02:00Z')
  let raw=exportReviews([old])
  const saved=persistReview({getItem:()=>raw,setItem:(_,value)=>raw=value},[pending],next)
  expect(saved.find(r=>r.id===pending.id)).toEqual(pending)
  expect(readReviews(raw).find(r=>r.id===pending.id)).toEqual(pending)
})

it('identifies unavailable reference and component glyphs', () => {
  const c=createSealCandidates({...doc,table:{},parts:[{part:wood,kind:'seal'}]},table).compare(head)
  expect(c.glyphAvailable).toBe(false)
  expect(c.candidates[0].missingGlyphs).toEqual([])
  expect(c.candidates[2].missingGlyphs).toEqual([variant])
})

it('retains the supplemental modern table in exported candidate provenance', async () => {
  const adapter = smallSealAdapter({data:doc, ids:'https://example.test/base.tsv', additionalIds:'https://example.test/extra.tsv', palette:[], fetch:async url => new Response(String(url).endsWith('extra.tsv') ? '林\t⿰木木' : '')})
  const comparison=(await adapter.sealReview('林')).items[0]
  expect(comparison.candidates).toHaveLength(2)
  expect(comparison.modernSource).toBe('https://example.test/base.tsv + https://example.test/extra.tsv')
  const candidate=comparison.candidates[0]
  const review=makeReview(comparison,candidate,candidate.text,'','accepted')
  expect(JSON.parse(exportReviews([review])).reviews[0].evidence.modernSource).toBe(comparison.modernSource)
})
