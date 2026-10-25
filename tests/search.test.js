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
  it('finds nothing for a shape no character has', () => {
    expect(chars('⿲木木木')).toEqual([])
    expect(search.search('').problem).toBe('empty')
  })
})
