import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { formRows, matches, querySummary, sideText } from '../demo/lib/custom-forms.js'

const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
const rows = formRows(doc)
const find = (query, source = 'all', status = 'any') => rows.filter(row => matches(row, querySummary(query), source, status))
const outside = rows.find(row => row.names.some(name => name.text === '{53}'))

describe('the appendix table of forms', () => {
  it('has one row per form, in the order of their identifiers', () => {
    expect(rows).toHaveLength(doc.forms.length)
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length)
    expect(rows.every((row, at) => at === 0 || rows[at - 1].number < row.number)).toBe(true)
    // Every custom component is on exactly one row.
    const named = rows.flatMap(row => row.names.filter(name => name.source !== 'unnamed').map(name => name.text))
    expect(named.sort()).toEqual(doc.components.map(row => row.text).sort())
  })
  it('gathers a form\'s names, equivalents, uses and derived descriptions', () => {
    expect(outside.names.map(name => [name.source, name.text])).toEqual([['babelstone', '{53}'], ['chise', '&CDP-8964;']])
    expect(outside.names[0].description).toBe('outside of 鸟岛 (F2E7)')
    expect(outside.status).toBe('confirmed')
    expect(outside.equivalents[0]).toMatchObject({ in: 'zi-tools', text: '⿱丿⿴#(-𠃌㇉)丶', status: 'confirmed' })
    // Its other name is no equivalent of itself.
    expect(outside.equivalents.some(item => item.text === '&CDP-8964;' || item.text === '{53}')).toBe(false)
    expect([...outside.usedIn]).toContain('鸟')
    expect(outside.uses).toBe([...outside.usedIn].length)
    expect(outside.derived.find(row => row.char === '乌' && row.in === 'babelstone').text).toBe('⿹㇯{53}丶一')
  })
  it('says which form an unnamed one was found for', () => {
    const arranged = rows.find(row => row.names[0].text === '⿴⿱丿#(-𠃌㇉)丶')
    expect(arranged.names[0].source).toBe('unnamed')
    expect(arranged.of).toContainEqual({ id: outside.id, relation: 'arrangement' })
    expect(arranged.status).toBe('candidate')
    // An expression two forms of one source both confirm belongs to neither; it says so.
    const shared = rows.filter(row => row.of.some(other => other.relation === 'confirmed'))
    for (const row of shared) expect(row.status).toBe('confirmed')
    // Two names giving one equivalent pool their characters.
    for (const row of rows) for (const item of row.equivalents) expect(item.count).toBeGreaterThanOrEqual(Math.min(item.characters.length, 1))
  })
  it('finds a form by identifier, name, description, part or a character it stands in', () => {
    expect(find(outside.id).map(row => row.id)).toContain(outside.id)
    expect(find(`&${outside.id};`)[0].id).toBe(outside.id)
    expect(find('{53}')[0].id).toBe(outside.id)
    expect(find('cdp-8964')[0].id).toBe(outside.id)
    expect(find('outside of 鸟').map(row => row.id)).toEqual([outside.id])
    expect(find('鸟').map(row => row.id)).toContain(outside.id)
    expect(find('#(-𠃌㇉)').length).toBeGreaterThan(1)
    // A character whose derived description names the form finds it too.
    const derivedOnly = outside.derived.find(row => !outside.usedIn.includes(row.char))
    expect(find(derivedOnly.char).map(row => row.id)).toContain(outside.id)
    // Every term must hold.
    expect(find('鸟 zzz')).toEqual([])
    expect(find('')).toHaveLength(rows.length)
  })
  it('narrows by source and by status', () => {
    expect(find('', 'babelstone')).toHaveLength(doc.counts.bySource.babelstone)
    expect(find('', 'unnamed').every(row => row.names.every(name => name.source === 'unnamed'))).toBe(true)
    expect(find('', 'all', 'confirmed').length + find('', 'all', 'candidate').length + find('', 'all', 'none').length).toBe(rows.length)
    expect(find('', 'all', 'none').every(row => !row.equivalents.length)).toBe(true)
    expect(find('', 'yours')).toEqual([])
  })
  it('shows a reader\'s pair beside the form either side names', () => {
    expect(sideText('bsp:7')).toBe('{7}')
    expect(sideText('chise:CDP-8BD0')).toBe('&CDP-8BD0;')
    expect(sideText('ucs:53C0')).toBe('叀')
    const mine = formRows(doc, [{ a: 'bsp:53', b: 'ucs:9E1F', note: 'checked' }])
    const row = mine.find(row => row.id === outside.id)
    expect(row.yours).toEqual([{ other: '鸟', note: 'checked' }])
    expect(mine.filter(row => matches(row, [], 'yours', 'any')).map(row => row.id)).toEqual([outside.id])
    expect(matches(row, querySummary('checked'), 'all', 'any')).toBe(true)
    // Two pairs to one other side are one line, and a name matches in any case.
    const twice = formRows(doc, [{ a: 'bsp:53', b: 'ucs:9E1F', note: 'one' }, { a: 'chise:cdp-8964', b: 'ucs:9E1F', note: 'two' }])
    expect(twice.find(row => row.id === outside.id).yours).toEqual([{ other: '鸟', note: 'one · two' }])
  })
})
