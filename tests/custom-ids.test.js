import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parse } from '../src/core/ids.js'
import { createCustomComponents } from '../src/core/custom-components.js'
import { assignIds, formChar, formEntity, formId, readLedger, writeLedger } from '../scripts/lib/custom-ids.mjs'

const form = (...aliases) => ({ first: aliases[0], aliases })
const ids = rows => rows.map(row => [row.id, row.alias, row.note].join(' '))

describe('the ledger of form identifiers', () => {
  it('writes an identifier a description reads as one component', () => {
    expect(formId(53)).toBe('X-00053')
    expect(formEntity('X-00053')).toBe('&X-00053;')
    expect(formChar('X-00053').codePointAt(0)).toBe(0xf0035)
    expect(parse('⿹&X-00053;一').tree).toEqual({ op: '⿹', parts: ['&X-00053;', '一'] })
  })
  it('mints in the order given and keeps what it minted', () => {
    const one = assignIds([form('{1}', '&A;'), form('{2}')], [], '2026-01-01')
    expect(ids(one.rows)).toEqual(['X-00001 {1} first', 'X-00001 &A; ', 'X-00002 {2} first'])
    // A new form in front takes the next number; nothing moves.
    const two = assignIds([form('{0}'), form('{1}', '&A;'), form('{2}')], one.rows, '2026-02-01')
    expect(two.idOf.get('{0}')).toBe('X-00003')
    expect(two.idOf.get('{1}')).toBe('X-00001')
    expect(two.rows.find(row => row.alias === '{1}').since).toBe('2026-01-01')
    expect(readLedger(writeLedger(two.rows))).toEqual(two.rows)
  })
  it('keeps the lower number when two forms prove to be one, and never reuses the other', () => {
    const before = assignIds([form('{1}'), form('{2}')], [], '2026-01-01')
    const merged = assignIds([form('{1}', '{2}')], before.rows, '2026-02-01')
    expect(merged.idOf.get('{2}')).toBe('X-00001')
    expect(merged.rows.at(-1)).toEqual({ id: 'X-00002', alias: '', since: '2026-02-01', note: 'merged into X-00001' })
    const later = assignIds([form('{1}', '{2}'), form('{3}')], merged.rows, '2026-03-01')
    expect(later.idOf.get('{3}')).toBe('X-00003')
  })
  it('mints anew for the side of a split that lacks the first name', () => {
    const before = assignIds([form('{1}', '&A;')], [], '2026-01-01')
    const split = assignIds([form('{1}'), form('&A;')], before.rows, '2026-02-01')
    expect(split.idOf.get('{1}')).toBe('X-00001')
    expect(split.idOf.get('&A;')).toBe('X-00002')
  })
  it('withdraws a number whose first name is gone', () => {
    const before = assignIds([form('{1}'), form('{2}')], [], '2026-01-01')
    const after = assignIds([form('{2}')], before.rows, '2026-02-01')
    expect(after.rows.find(row => row.id === 'X-00001')).toEqual({ id: 'X-00001', alias: '{1}', since: '2026-02-01', note: 'withdrawn' })
    expect(assignIds([form('{2}'), form('{9}')], after.rows, '2026-03-01').idOf.get('{9}')).toBe('X-00003')
  })
})

describe('form identifiers in data/custom-components.json.gz', () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
  const ledger = readLedger(readFileSync(new URL('../data/custom-ids.tsv', import.meta.url), 'utf8'))
  const component = text => doc.components.find(row => row.text === text)

  it('gives every component one, and every form a different one', () => {
    for (const row of doc.components) expect(row.id).toMatch(/^X-\d{5}$/)
    expect(new Set(doc.forms.map(row => row.id)).size).toBe(doc.forms.length)
    expect(doc.counts.forms).toBe(doc.forms.length)
    const named = new Map(doc.forms.flatMap(row => row.names.map(name => [name, row.id])))
    expect(named.size).toBe(doc.forms.reduce((n, row) => n + row.names.length, 0))
    for (const row of doc.components) expect(named.get(row.text)).toBe(row.id)
    // The ledger and the file say the same.
    for (const row of ledger) if (row.alias && row.note !== 'withdrawn') expect(named.get(row.alias)).toBe(row.id)
  })
  it('joins two names only where the tables confirm it, and never two of one source', () => {
    expect(component('{53}').id).toBe(component('&CDP-8964;').id)
    for (const row of doc.forms) {
      const sources = row.names.map(name => component(name)?.source).filter(Boolean)
      expect(new Set(sources).size).toBe(sources.length)
    }
  })
  it('keeps another arrangement and an unconfirmed expression apart', () => {
    const spelled = component('{53}').equivalents.find(item => item.in === 'zi-tools' && item.basis === 'difference')
    expect(spelled.id).toBe(component('{53}').id)
    expect(spelled.arrangements[0].text).toBe('⿴⿱丿#(-𠃌㇉)丶')
    expect(spelled.arrangements[0].id).not.toBe(spelled.id)
    for (const row of doc.components) for (const item of row.equivalents) {
      // An expression one character gives is the component's own form only where another row of
      // the same form confirms it.
      const confirmed = doc.forms.find(form => form.id === row.id).names.includes(item.text)
      if (item.basis === 'difference' && item.status === 'candidate' && item.id && !confirmed) expect(item.id).not.toBe(row.id)
    }
    expect(doc.characters.find(row => row.char === '乌' && row.in === 'babelstone').ids).toEqual([component('{53}').id])
  })
  it('draws an identifier as the form it names', () => {
    const custom = createCustomComponents(doc)
    const id = component('{22}').id
    expect(custom.form(`&${id};`).names).toContain('{22}')
    expect(custom.form('{22}').id).toBe(id)
    expect(custom.drawable(`⿹&${id};一`)).toBe('⿹⿺㇉一一')
    expect(custom.drawable('⿹&X-99999;一')).toBe('⿹&X-99999;一')
  })
})

describe('a form written as a character less its other parts', () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
  const custom = createCustomComponents(doc)
  const id = text => doc.components.find(row => row.text === text).id

  it('lists every such spelling, with one or two parts taken', () => {
    const horse = doc.components.find(row => row.text === '{51}').subtractions
    expect(horse).toContain('㇯馬灬')
    expect(horse).toContain('㇯㇯𠙖冫几')
    expect(doc.components.find(row => row.text === '{53}').subtractions).toContain('㇯鸟一')
    for (const row of doc.components) for (const written of row.subtractions ?? []) expect(parse(written).problem).toBeUndefined()
  })
  it('gives a spelling to one form only', () => {
    const owner = new Map()
    for (const row of doc.components) for (const written of row.subtractions ?? []) {
      expect(owner.get(written) ?? row.id).toBe(row.id)
      owner.set(written, row.id)
    }
  })
  it('normalizes a subtraction to the form, alone or inside a description', () => {
    expect(custom.normalize('㇯馬灬')).toBe(`&${id('{51}')};`)
    expect(custom.normalize('⿰木㇯鸟一')).toBe(`⿰木&${id('{53}')};`)
    expect(custom.normalize('⿰氵㇯㇯𠙖冫几')).toBe(`⿰氵&${id('{51}')};`)
    // A subtraction that names no form, and a text with none, stay as they are.
    expect(custom.normalize('㇯軍車')).toBe('㇯軍車')
    expect(custom.normalize('⿰木木')).toBe('⿰木木')
    expect(custom.normalize('㇯馬')).toBe('㇯馬')
  })
  it('draws a subtraction as the form it names', () => {
    expect(custom.drawable('㇯鸟一')).toBe(custom.get('{53}').draw)
    expect(custom.drawableLeaves('⿰木㇯馬灬')).toEqual({ text: `⿰木${custom.get('{51}').draw}`, leaves: [0, 1] })
    expect(custom.drawable('㇯軍車')).toBe('㇯軍車')
  })
})

describe('a component with the other ways its form is written', () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
  const custom = createCustomComponents(doc)

  it('names the form in each table, with its expression and subtractions', () => {
    const part = custom.describe('{53}')
    expect(part.id).toBe('X-00053')
    expect(part.description).toBe('outside of 鸟岛 (F2E7)')
    expect(part.names).toEqual([{ text: '&CDP-8964;', source: 'chise' }, { text: '⿱丿⿴#(-𠃌㇉)丶', source: null }])
    expect(part.subtractions).toContain('㇯鸟一')
    expect([...part.subtractions[0]].length).toBeLessThanOrEqual([...part.subtractions.at(-1)].length)
  })
  it('answers the same form from any of its names', () => {
    expect(custom.describe('&CDP-8964;').names.map(name => name.text)).toContain('{53}')
    expect(custom.describe('&X-00053;').names.map(name => name.text)).toEqual(['{53}', '&CDP-8964;', '⿱丿⿴#(-𠃌㇉)丶'])
    expect(custom.describe('&CDP-8964;').description).toBe('outside of 鸟岛 (F2E7)')
    expect(custom.describe('{9999}')).toBeUndefined()
  })
})
