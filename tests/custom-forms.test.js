import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { formRows, matches, querySummary, segments, sideText } from '../demo/lib/custom-forms.js'

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
    // A character is listed once, with every notation it is written in.
    expect(new Set(outside.derived.map(row => row.char)).size).toBe(outside.derived.length)
    const wu = outside.derived.find(row => row.char === '乌').spellings
    // What subtraction derives for 乌 is what BabelStone itself writes: the row is that table's own.
    expect(wu.find(one => one.in === 'babelstone')).toEqual({ in: 'babelstone', text: '⿹㇯{53}丶一', attested: true })
    // A table's own description and one derived for another table stand side by side.
    const niao = outside.derived.find(row => row.char === '鸟').spellings
    expect(niao.find(one => one.in === 'babelstone')).toEqual({ in: 'babelstone', text: '⿹{53}一', attested: true })
    expect(niao.find(one => one.in === 'zi-tools' && !one.attested).of).toBe('⿹{53}一')
    for (const row of rows) for (const one of row.derived) expect(new Set(one.spellings.map(s => s.in + s.text)).size).toBe(one.spellings.length)
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
    expect(find('', 'all', 'confirmed').length + find('', 'all', 'candidate').length + find('', 'all', 'editorial').length + find('', 'all', 'none').length).toBe(rows.length)
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

describe('a description with its custom parts set apart', () => {
  const idOf = name => ({ '{53}': 'X-00053', '#(-𠃌㇉)': 'X-01465' })[name]
  it('names each custom part\'s notation and form, and leaves the rest as text', () => {
    expect(segments('⿹㇯{53}丶一', idOf)).toEqual([{ text: '⿹㇯' }, { text: '{53}', source: 'babelstone', id: 'X-00053' }, { text: '丶一' }])
    expect(segments('⿱丿⿴#(-𠃌㇉)丶', idOf)).toEqual([{ text: '⿱丿⿴' }, { text: '#(-𠃌㇉)', source: 'zi-tools', id: 'X-01465' }, { text: '丶' }])
    expect(segments('&CDP-8964;', idOf)).toEqual([{ text: '&CDP-8964;', source: 'chise' }])
    expect(segments('⿰木&X-00053;', idOf)).toEqual([{ text: '⿰木' }, { text: '&X-00053;', source: 'form', id: 'X-00053' }])
    expect(segments('⿰木木', idOf)).toEqual([{ text: '⿰木木' }])
  })
})

describe('a form read as an encoded character', () => {
  it('carries the reading and what it rests on, and is found by the character', () => {
    const row = rows.find(one => one.names.some(name => name.text === '#(-𠃍㇉)'))
    expect(row.character).toMatchObject({ text: '𢎘z', in: 'zi-tools', basis: 'editorial' })
    expect(row.character.reason).toContain('⿹𢎘z一')
    expect(row.status).toBe('editorial')
    expect(find('𢎘z').map(one => one.id)).toContain(row.id)
    expect(find('', 'all', 'editorial').map(one => one.id)).toEqual([row.id])
  })
})

describe('the forms table as files', () => {
  const read = name => readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8')
  const json = JSON.parse(read('custom-forms.json'))
  it('has one row per form in each format, under the same columns', () => {
    expect(json.format).toBe('ids-input/custom-forms')
    expect(json.licence).toBe('GPL-2.0-or-later')
    expect(json.rows).toHaveLength(doc.forms.length)
    const tsv = read('custom-forms.tsv').trimEnd().split('\n')
    expect(tsv[0].startsWith('# ')).toBe(true)
    expect(tsv[1].split('\t')).toEqual(json.columns)
    expect(tsv).toHaveLength(json.rows.length + 2)
    for (const line of tsv.slice(1)) expect(line.split('\t')).toHaveLength(json.columns.length)
    const csv = read('custom-forms.csv').trimEnd().split('\r\n')
    expect(csv[0]).toBe(json.columns.join(','))
    expect(csv).toHaveLength(json.rows.length + 1)
  })
  it('says the same as the table', () => {
    const row = json.rows.find(one => one.babelstone === '{53}')
    expect(row).toMatchObject({ id: outside.id, entity: `&${outside.id};`, chise: '&CDP-8964;', status: 'confirmed', uses: outside.uses })
    expect(row.char).toBe(`U+${(0xf0000 + outside.number).toString(16).toUpperCase()}`)
    expect(row.equivalents[0]).toMatchObject({ in: 'zi-tools', text: '⿱丿⿴#(-𠃌㇉)丶', status: 'confirmed' })
    const line = read('custom-forms.tsv').split('\n').find(one => one.startsWith(`${outside.id}\t`))
    expect(line.split('\t')[json.columns.indexOf('equivalents')]).toContain('zi-tools:⿱丿⿴#(-𠃌㇉)丶:confirmed')
    expect(line.split('\t')[json.columns.indexOf('subtractions')]).toContain('㇯鸟一')
    expect(json.rows.find(one => one.zi_tools === '#(-𠃍㇉)')).toMatchObject({ character: '𢎘z', status: 'editorial' })
  })
})

describe('a form found by its subtraction', () => {
  it('is on the row, and a query for it finds the form', () => {
    const horse = rows.find(row => row.names.some(name => name.text === '{51}'))
    expect(horse.subtractions).toContain('㇯馬灬')
    expect(find('㇯馬灬').map(row => row.id)).toEqual([horse.id])
    expect(find('㇯鸟一').map(row => row.id)).toContain(outside.id)
  })
})
