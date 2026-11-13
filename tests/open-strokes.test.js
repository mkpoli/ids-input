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
const point = char => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`

describe('the open stroke-order release', () => {
  it('names its format, sources and their terms', () => {
    expect(manifest.format).toBe('ids-input/open-strokes')
    expect(manifest.version).toBe(1)
    expect(manifest.sources.map(source => source.key)).toEqual(['rime-stroke', 'cns11643', 'babelstone-ids'])
    for (const source of manifest.sources) {
      expect(source.url).toMatch(/^https:/)
      expect(source.licence.spdx ?? source.licence.name).toBeTruthy()
      expect(readme).toContain(source.url)
    }
    expect(readme).toContain('LGPL-3.0')
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

  it('keeps each source in its own symbols', () => {
    expect(rime.slice(1).every(row => /^[hspnz]+( [hspnz]+)*$/.test(row[2]))).toBe(true)
    expect(cns.slice(1).every(row => /^[1-5]+( [1-5]+)*$/.test(row[2]) && /^\d+-[0-9A-F]{4}( \d+-[0-9A-F]{4})*$/.test(row[3]))).toBe(true)
    const mainland = orders(rime), taiwan = orders(cns)
    expect(mainland.get('王')).toEqual(['hhsh'])
    expect(taiwan.get('王')).toEqual(['1121'])
    // The two styles write 乃 in different orders.
    expect(mainland.get('乃')).toEqual(['pz', 'zp'])
    expect(taiwan.get('乃')).toEqual(['35'])
  })

  it('marks every induced row with its basis and the source it is written from', () => {
    const tables = { mainland: orders(rime), taiwan: orders(cns) }
    const source = { mainland: 'rime-stroke', taiwan: 'cns11643' }
    for (const [char, , style, written, basis, from, key] of induced.slice(1)) {
      expect(key).toBe(source[style])
      // An induced row never stands in for a character its source records.
      expect(tables[style].has(char)).toBe(false)
      expect(['equivalent', 'ids']).toContain(basis)
      if (basis === 'equivalent') {
        expect(char.normalize('NFKC')).toBe(from)
        expect(written.split(' ')).toEqual(tables[style].get(from))
      } else {
        expect([...from].some(part => manifest.induction.operators.includes(part))).toBe(true)
        expect(written.split(' ').length).toBeLessThanOrEqual(manifest.induction.ways)
      }
    }
    const row = induced.find(row => row[0] === '⼀' && row[2] === 'taiwan')
    expect(row?.slice(3)).toEqual(['1', 'equivalent', '一', 'cns11643'])
  })

  it('counts its coverage and scores its rules on the recorded characters', () => {
    for (const row of manifest.coverage) {
      const rows = induced.slice(1).filter(entry => entry[2] === row.style)
      expect(rows.filter(entry => entry[4] === 'equivalent').length).toBe(row.equivalent)
      expect(rows.filter(entry => entry[4] === 'ids').length).toBe(row.ids)
      expect(readme).toContain(row.recorded.toLocaleString('en'))
    }
    expect(manifest.coverage.find(row => row.style === 'mainland').recorded).toBe(rime.length - 1)
    expect(manifest.coverage.find(row => row.style === 'taiwan').recorded).toBe(cns.length - 1)
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
