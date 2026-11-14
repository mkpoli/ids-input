// The open stroke-order release: files that say where every row comes from, checked against the
// manifest that describes them.
import { describe, expect, it } from 'bun:test'
import { readFileSync, statSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const at = name => new URL(`../data/open-strokes/${name}`, import.meta.url)
const manifest = JSON.parse(readFileSync(at('manifest.json'), 'utf8'))
const readme = readFileSync(at('README.md'), 'utf8')
const table = name => gunzipSync(readFileSync(at(name))).toString().trimEnd().split('\n').map(line => line.split('\t'))
const rime = table('rime-stroke.tsv.gz'), cns = table('cns11643.tsv.gz'), induced = table('induced.tsv.gz')
const orders = rows => new Map(rows.slice(1).map(row => [row[0], row[2].split(' ')]))
const digits = code => [...code].map(letter => ({ h: '1', s: '2', p: '3', n: '4', z: '5' })[letter]).join('')
const point = char => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`

describe('the open stroke-order release', () => {
  it('names its format, sources and their terms', () => {
    expect(manifest.format).toBe('ids-input/open-strokes')
    expect(manifest.version).toBe(1)
    expect(manifest.sources.map(source => source.key)).toEqual(['cns11643', 'rime-stroke', 'babelstone-ids'])
    for (const source of manifest.sources) {
      expect(source.url).toMatch(/^https:/)
      expect(source.licence.spdx ?? source.licence.name).toBeTruthy()
      expect(readme).toContain(source.url)
    }
    expect(readme).toContain('LGPL-3.0')
    // The LGPL's text travels with the data, and the README says the table was changed.
    for (const name of manifest.texts) expect(statSync(at(name)).size).toBeGreaterThan(0)
    expect(manifest.texts).toContain('LICENSE-rime-stroke-LGPL-3.0.txt')
    expect(readme).toContain('modified form')
    expect(readme).toContain('數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。')
  })

  it('lists each file with its rows, columns and size', () => {
    for (const [file, rows] of [['rime-stroke.tsv.gz', rime], ['cns11643.tsv.gz', cns], ['induced.tsv.gz', induced]]) {
      const entry = manifest.files.find(entry => entry.name === file)
      expect(rows[0]).toEqual(entry.columns)
      expect(rows.length - 1).toBe(entry.rows)
      expect(statSync(at(file)).size).toBe(entry.bytes)
      expect(rows.every(row => row.length === entry.columns.length)).toBe(true)
      expect(rows.slice(1).every(row => [...row[0]].length === 1 && row[1] === point(row[0]))).toBe(true)
    }
  })

  it('keeps each source in its own symbols, Han characters only', () => {
    expect(rime.slice(1).every(row => /^[hspnz]+( [hspnz]+)*$/.test(row[2]))).toBe(true)
    expect(cns.slice(1).every(row => /^[1-5]+( [1-5]+)*$/.test(row[2]) && /^\d+-[0-9A-F]{4}( \d+-[0-9A-F]{4})*$/.test(row[3]))).toBe(true)
    for (const rows of [rime, cns, induced]) expect(rows.slice(1).some(row => /\p{Script=Tangut}/u.test(row[0]))).toBe(false)
    expect(orders(rime).get('王')).toEqual(['hhsh'])
    expect(orders(cns).get('王')).toEqual(['1121'])
  })

  it('says how far the two sources agree', () => {
    const a = orders(cns), b = orders(rime)
    const shared = [...a.keys()].filter(char => b.has(char))
    expect(manifest.agreement.shared).toBe(shared.length)
    expect(manifest.agreement.sameOrder).toBe(shared.filter(char => b.get(char).some(code => a.get(char).includes(digits(code)))).length)
    expect(manifest.agreement.blocks.reduce((sum, row) => sum + row.shared, 0)).toBe(shared.length)
    // The Rime table is the CNS one for most of what both record.
    expect(manifest.agreement.sameOrder / manifest.agreement.shared).toBeGreaterThan(0.98)
    expect(readme).toContain(manifest.agreement.sameOrder.toLocaleString('en'))
  })

  it('marks every induced row with its basis and the source it is written from', () => {
    const tables = { 'rime-stroke': orders(rime), cns11643: orders(cns) }
    for (const [char, , written, basis, from, key] of induced.slice(1)) {
      // An induced row never stands in for a character its source records.
      expect(tables[key].has(char)).toBe(false)
      expect(['equivalent', 'ids']).toContain(basis)
      if (basis === 'equivalent') {
        expect(char.normalize('NFKC')).toBe(from)
        expect(written.split(' ')).toEqual(tables[key].get(from))
      } else {
        expect([...from].some(part => manifest.induction.operators.includes(part))).toBe(true)
        expect(from.startsWith('〾')).toBe(false)
        expect(written.split(' ').length).toBeLessThanOrEqual(manifest.induction.ways)
      }
    }
    // A numbered component is read by its fragment, and the row keeps BabelStone's spelling.
    expect(induced.some(row => row[3] === 'ids' && /\{\d+\}/.test(row[4]))).toBe(true)
    const row = induced.find(row => row[0] === '⼀' && row[5] === 'cns11643')
    expect(row?.slice(2)).toEqual(['1', 'equivalent', '一', 'cns11643'])
  })

  it('counts its coverage and scores its rules on the recorded characters', () => {
    for (const row of manifest.coverage) {
      const rows = induced.slice(1).filter(entry => entry[5] === row.source)
      expect(rows.filter(entry => entry[3] === 'equivalent').length).toBe(row.equivalent)
      expect(rows.filter(entry => entry[3] === 'ids').length).toBe(row.ids)
      expect(readme).toContain(row.recorded.toLocaleString('en'))
    }
    expect(manifest.coverage.find(row => row.source === 'rime-stroke').recorded).toBe(rime.length - 1)
    expect(manifest.coverage.find(row => row.source === 'cns11643').recorded).toBe(cns.length - 1)
    for (const { operators } of manifest.induction.validation) {
      for (const row of operators) {
        expect(row.agree).toBeLessThanOrEqual(row.written)
        expect(row.written).toBeLessThanOrEqual(row.described)
        expect(row.induced).toBe(manifest.induction.operators.includes(row.operator))
      }
      // The operators induced through agree with the source on most of what it records.
      const kept = operators.filter(row => row.induced)
      expect(kept.reduce((sum, row) => sum + row.agree, 0) / kept.reduce((sum, row) => sum + row.written, 0)).toBeGreaterThan(0.85)
    }
  })
})
