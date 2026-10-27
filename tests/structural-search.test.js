import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createStructuralSearch, STRUCTURAL_PRESETS } from '../src/core/structural-search.js'
import { readForms } from '../src/core/search.js'
import { babelStoneAdapter, parseIdsTable } from '../src/adapter/babelstone.js'
import catalog from '../src/composer/pyramid-glyphs.json' with { type: 'json' }

const table = new Map([
  ['林', ['⿰木木']], ['森', ['⿱木林']], ['晶', ['⿱日⿰日日']], ['雑', ['⿱木⿰木日']],
  ['淼', ['⿱水⿰水水']], ['澁', ['⿰氵⿱木林']], ['㗊', ['⿱吅吅']], ['吅', ['⿰口口']],
  ['燚', ['⿰炎炎']], ['炎', ['⿱火火']], ['返', ['⿰乙甲']], ['甲', ['⿰乙丙']], ['乙', ['⿰甲丙']],
  ['一', ['一']], ['异', ['⿱木⿰木日', '⿱木林']], ['合', ['⿱？⿰？？']],
])
const chars = result => result.hits.map(h => h.char)
it('binds repeated components across encoded subtrees and keeps matching at the root', () => {
  const search = createStructuralSearch(table)
  expect(chars(search.search('⿱A⿰AA'))).toEqual(['晶', '森', '淼', '异'].sort((a,b)=>a.codePointAt(0)-b.codePointAt(0)))
  expect(chars(search.search('⿱木⿰木木'))).toEqual(['森', '异'].sort((a,b)=>a.codePointAt(0)-b.codePointAt(0)))
  expect(chars(search.search('⿱⬚⿰⬚⬚'))).toContain('雑')
  expect(chars(search.search('⿱A⿰AA'))).not.toContain('澁')
  expect(chars(search.search('⿱A⿰AA'))).not.toContain('合')
})
it('finds both grid orientations without duplicates', () => {
  const s = createStructuralSearch(table), q = STRUCTURAL_PRESETS.find(p => p.id === 'grid').query
  expect(new Set(chars(s.search(q)))).toEqual(new Set(['㗊','燚']))
})
it('keeps independent variable bindings across decomposition alternatives', () => {
  const s = createStructuralSearch(new Map([['試',['⿱⿰木日下']], ['下',['⿰木月','⿰木日']]]))
  expect(chars(s.search('⿱AA'))).toEqual(['試'])
})
it('rejects incomplete, nonstructural or oversized queries, and terminates on cycles', () => {
  const s = createStructuralSearch(table)
  for (const q of ['⿱A','A','⿱AAA','⿱AA|','⿱AA|'.repeat(10)]) expect(s.search(q).problem).toBe('pattern')
  expect(s.search('').problem).toBe('empty')
  expect(s.search('⿲AAA').total).toBe(0)
  const r = s.search('⿱A⿰AA', { limit: 1 }); expect(r.total).toBe(4); expect(r.hits).toHaveLength(1)
})
const corpus = new Map([...parseIdsTable(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString())].map(([c, ss]) => [c, ss.map(s=>s.text)]))
const forms = readForms(readFileSync(new URL('../data/component-forms.tsv', import.meta.url),'utf8'))
it('covers the complete pyramid catalog, including positional forms, with usable result sequences', () => {
  const s = createStructuralSearch(corpus,{forms}), r = s.search('⿱A⿰AA',{limit:100000})
  for (const {char} of catalog.entries) expect(chars(r)).toContain(char)
  const hit = r.hits.find(h=>h.char==='森'); expect(hit.sequence).toBe('⿱木⿰木木')
  expect(hit.spans).toEqual([[0,5]])
})
it('every preset actually finds its displayed examples', () => {
  const s = createStructuralSearch(corpus,{forms})
  for (const p of STRUCTURAL_PRESETS) {
    const found = chars(s.search(p.query,{limit:100000}))
    for (const c of p.examples.split(' ')) expect(found, `${p.id}: ${c}`).toContain(c)
  }
}, 20000)
it('exposes structural matching through the local adapter and respects abortion', async () => {
  const adapter = babelStoneAdapter({table:new Map([...table].map(([c,ss])=>[c,ss.map(text=>({text}))]))})
  expect((await adapter.findByStructure('⿱A⿰AA')).total).toBe(4)
  const c = new AbortController(); c.abort()
  await expect(adapter.findByStructure('⿱A⿰AA',{signal:c.signal})).rejects.toThrow()
})

it('keeps one compatible expansion for every occurrence of a variable', () => {
  const s = createStructuralSearch(new Map([
    ['甲',['⿰木木','⿰日日']], ['林',['⿰木木']], ['昌',['⿰日日']],
    ['偽',['⿱甲⿰林昌']], ['真',['⿱甲⿰昌昌']],
  ]))
  expect(chars(s.search('⿱A⿰AA'))).toEqual(['真'])
  expect(s.search('⿱A⿰AA',{limit:0}).characters).toBe('真')
})

it('deduplicates common expansions before combining repeated alternatives', () => {
  const row = part => '⿰'.repeat(9) + Array(10).fill(part).join('')
  const search = createStructuralSearch(new Map([
    ['丁',['⿰木木','⿰朩木']], ['林',['⿰木木']], ['甲',[row('丁')]], ['乙',[row('林')]], ['試',['⿱甲⿰乙日']],
  ]), { forms: new Map([['朩','木']]) })
  expect(search.search('⿱A⿰AA').total).toBe(0)
}, 1000)
