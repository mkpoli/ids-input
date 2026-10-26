import { describe, expect, it } from 'bun:test'
import { createSearch, parseQuery, readForms } from '../src/core/index.js'

// A few descriptions, as BabelStone writes them (regions dropped).
const table = new Map(Object.entries({
  木: ['⿻十八'], 十: ['⿻一丨'], 林: ['⿰木木'], 森: ['⿱木林'], 本: ['⿻木一'], 口: ['口'],
  杏: ['⿱木口'], 呆: ['⿱口木'], 困: ['⿴囗木'], 相: ['⿰木目'], 想: ['⿱相心'], 箱: ['⿱⺮相'],
  沐: ['⿰氵木'], 淋: ['⿰氵林'], 休: ['⿰亻木'], 体: ['⿰亻本'],
}))
const forms = readForms('form\tchar\tsource\tdetail\n⺡\t氵\tunicode-ucd\tx\n氵\t水\tcjkvi-variants\tleft\n亻\t人\tcjkvi-variants\tleft\n')
const search = createSearch(table, { forms })
const chars = query => search.search(query).hits.map(h => h.char)

describe('a query', () => {
  it('reads structures, wildcards, runs of components and ASCII names', () => {
    const { terms } = parseQuery('⿰？木　木口 lr氵＋')
    expect(terms.map(t => t.kind)).toEqual(['structure', 'components', 'structure'])
    expect(terms[0].tree).toEqual({ op: '⿰', parts: [null, '木'] })
    expect(terms[2].tree).toEqual({ op: '⿰', parts: ['氵', null] })
    expect(parseQuery('  ').problem).toBe('empty')
  })
})

describe('the search', () => {
  it('matches a whole description first, then the same shape deeper inside', () => {
    expect(chars('⿰木木')).toEqual(['林', '森', '淋'])
    expect(search.search('⿰木木').hits[0].sequence).toBe('⿰木木')
  })
  it('opens components where the query has structure', () => {
    const [hit] = search.search('⿱木⿰木木').hits
    expect(hit.char).toBe('森')
    expect(hit.sequence).toBe('⿱木⿰木木')
    expect(hit.spans).toEqual([[0, 5]])
  })
  it('takes an empty slot or ？ as any part, a component or a subtree, at any depth', () => {
    expect(chars('⿰？木')).toEqual(['休', '林', '沐', '森', '淋'])
    expect(chars('⿱⬚口')).toEqual(['杏'])
    expect(chars('⿱＋口')).toEqual(['杏'])
    expect(chars('⿱？⿰木目')).toEqual(['箱'])
    expect(chars('⿱⿰木目？')).toEqual(['想'])
  })
  it('highlights where the match lies', () => {
    const hit = search.search('⿰木目').hits.find(h => h.char === '想')
    expect(hit.sequence).toBe('⿱⿰木目心')
    expect(hit.spans).toEqual([[1, 4]])
  })
  it('needs every term to match', () => {
    expect(chars('⿰？？ 氵')).toEqual(['沐', '淋'])
    expect(chars('⿰？木 亻')).toEqual(['休'])
  })
  it('reads a run of components as all of them held, counted', () => {
    expect(chars('木木')).toEqual(['林', '森', '淋'])
    expect(chars('木木木')).toEqual(['森'])
    expect(chars('木')[0]).not.toBe('森')
    expect(chars('木林')).toEqual(['森', '淋'])
    expect(chars('口木')).toEqual(['呆', '杏'])
    const hit = search.search('口木').hits[0]
    expect(hit.spans.length).toBe(2)
  })
  it('folds radical and positional forms together', () => {
    expect(chars('⿰⺡木')).toEqual(['沐'])
    expect(chars('⿰水木')).toEqual(['沐'])
    expect(chars('人')).toEqual(['休', '体'])
  })
  it('matches the parts of ⿻ in either order', () => {
    expect(chars('⿻八十')).toEqual(chars('⿻十八'))
    expect(chars('⿻八十')[0]).toBe('木')
  })
  it('needs one description to hold a run, not several together', () => {
    const two = createSearch(new Map(Object.entries({ C: ['⿰木木', '⿱口口'], X: ['⿰C丨'], 林: ['⿰木木'] })))
    expect(two.search('木木口口').hits.map(h => h.char)).not.toContain('C')
    expect(two.search('木木').hits.map(h => h.char).sort()).toEqual(['C', 'X', '林'].sort())
  })
  it('counts nothing a cycle or ㇯ would add, and finds every member of a cycle', () => {
    const cycle = createSearch(new Map(Object.entries({ 水: ['⿰㇇甲'], 甲: ['㇯水㇇'], 冰: ['⿰冫水'], A: ['⿰B口'], B: ['⿱A木'] })))
    expect(cycle.search('水水').hits.map(h => h.char)).toEqual([])
    expect(cycle.search('口').hits.map(h => h.char).sort()).toEqual(['A', 'B'])
  })
  it('refuses a structure with more than its operators take', () => {
    expect(search.search('⿰木木木').problem).toBe('extra')
  })
  it('finds nothing for a shape no character has', () => {
    expect(chars('⿲木木木')).toEqual([])
    expect(search.search('').problem).toBe('empty')
  })
})


describe('visual substitutes in IDS queries', () => {
  const shapes = createSearch(new Map(Object.entries({
    人: ['人'], 亼: ['⿱𠆢一'], 从: ['⿰人人'], 众: ['⿱人从'],
    休: ['⿰亻木'], 合: ['⿱亼口'], 余: ['⿱亼朩'], 木: ['木'], 口: ['口'],
  })), { forms })
  const result = query => shapes.search(query)

  it('accepts the requested shapes in runs and structures, including positional forms', () => {
    for (const [alias, canonical] of [
      ['ㅅ', '人'], ['ᄉ', '人'], ['ᆺ', '人'], ['스', '亼'], ['스', '亼'],
      ['⿰ㅅ木', '⿰人木'], ['⿱스口', '⿱亼口'], ['⿱스口', '⿱亼口'],
      ['ㅅㅅ', '人人'], ['스口', '亼口'], ['⿱스？ 口', '⿱亼？ 口'],
    ]) {
      expect(result(alias)).toEqual(result(canonical))
      expect(result(alias).hits.length).toBeGreaterThan(0)
    }
    expect(result('⿰ㅅ木').hits[0].char).toBe('休')
    expect(result('⿱스口').hits[0]).toMatchObject({ char: '合', sequence: '⿱亼口', spans: [[0, 3]] })
    expect(result('ㅅㅅ').hits.map(hit => hit.char)).not.toContain('休')
  })

  it('keeps the entered term, leaves other Hangul alone, and checks structure arity', () => {
    expect(parseQuery('⿱스口').terms[0]).toMatchObject({ text: '⿱스口', tree: { op: '⿱', parts: ['亼', '口'] } })
    expect(parseQuery('수').terms[0]).toMatchObject({ text: '수', leaves: ['수'] })
    expect(result('⿱스口木').problem).toBe('extra')
  })
})


it('preserves Han compatibility components and unrelated Hangul syllables', () => {
  const index = createSearch(new Map([['甲', ['⿰神木']], ['乙', ['⿰神木']]]))
  expect(index.search('⿰神木').hits.map(hit => hit.char)).toEqual(['甲'])
  expect(index.search('⿰神木').hits.map(hit => hit.char)).toEqual(['乙'])
  expect(parseQuery('슨').terms[0].leaves).toEqual(['슨'])
})
