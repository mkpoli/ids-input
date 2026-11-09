// The open data release: a table a reader can reuse without this package, built from the starter
// catalogue and checked to say what it holds.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { OPERATORS, parse } from '../src/core/index.js'

const read = name => readFileSync(new URL(`../data/open-data/${name}`, import.meta.url), 'utf8')
const dataset = JSON.parse(read('descriptions.json'))
const manifest = JSON.parse(read('manifest.json'))
const readme = read('README.md')
const tsv = read('descriptions.tsv').trimEnd().split('\n')
const componentsTsv = read('components.tsv').trimEnd().split('\n')
const equivalences = JSON.parse(read('equivalences.json'))
const equivalenceTsv = read('equivalences.tsv').trimEnd().split('\n')
const OPERATOR = new Set(OPERATORS.map(([operator]) => operator))
const SOURCES = new Map(dataset.sources.map(source => [source.key, source]))

describe('the open data release', () => {
  it('names its format, version and licence', () => {
    expect(dataset.format).toBe('ids-input/open-ids')
    expect(dataset.version).toBe(1)
    expect(dataset.licence.spdx).toBe('CC0-1.0')
    expect(dataset.licence.url).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
    expect(dataset.licence.note).toContain('public domain')
    expect(readme).toContain(dataset.licence.url)
    expect(readme).toContain('CC BY-SA 4.0')
  })

  it('counts what it holds', () => {
    expect(dataset.counts).toEqual({
      descriptions: 605, unencoded: 130, editorial: 65, groups: 20, sources: 77, components: 121,
    })
    expect(dataset.counts.descriptions).toBe(dataset.records.length)
    expect(dataset.counts.unencoded).toBe(dataset.records.filter(record => !record.char).length)
    expect(dataset.counts.editorial).toBe(dataset.records.filter(record => record.editorial).length)
    expect(dataset.counts.groups).toBe(dataset.groups.length)
    expect(dataset.counts.sources).toBe(dataset.sources.length)
    expect(dataset.counts.components).toBe(dataset.components.length)
    expect(dataset.groups.reduce((sum, group) => sum + group.count, 0)).toBe(dataset.counts.descriptions)
    expect(manifest.counts).toEqual(dataset.counts)
    expect(manifest.groups).toEqual(dataset.groups)
    expect(manifest.licence).toEqual(dataset.licence)
  })

  it('carries one row per description', () => {
    const keys = new Set(dataset.records.map(record => `${record.ids}\0${record.char}`))
    expect(keys.size).toBe(dataset.records.length)
    for (const record of dataset.records) {
      expect([...record.ids].some(char => OPERATOR.has(char))).toBe(true)
      expect(record).toHaveProperty('editorial')
    }
  })

  it('parses every description and component fragment', () => {
    for (const record of dataset.records) expect(parse(record.ids, { open: true }).tree).toBeTruthy()
    for (const component of dataset.components) {
      expect([...component.component].length).toBeGreaterThan(2)
      if (component.fragment) expect(parse(component.fragment, { open: true }).tree).toBeTruthy()
    }
  })

  it('writes a character and its code point together', () => {
    for (const record of dataset.records) {
      if (record.char) {
        expect([...record.char]).toHaveLength(1)
        expect(record.codepoint).toBe(`U+${(record.char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
      } else {
        expect(record.codepoint).toBeNull()
      }
    }
  })

  it('keeps the GPL small-seal rows out', () => {
    expect(dataset.records.some(record => record.group === 'seal')).toBe(false)
    expect(dataset.groups.some(group => group.key === 'seal')).toBe(false)
    expect(SOURCES.has('small-seal')).toBe(false)
    expect(readme).toContain('GPL-2.0-or-later')
  })

  it('cites a known source and uses every source it lists', () => {
    for (const record of dataset.records) {
      for (const key of record.sources) expect(SOURCES.has(key)).toBe(true)
    }
    const cited = new Set(dataset.records.flatMap(record => record.sources))
    for (const source of dataset.sources) {
      expect(cited.has(source.key)).toBe(true)
      expect(source.title.length).toBeGreaterThan(0)
      expect(source.note.length).toBeGreaterThan(0)
      expect(['checked', 'reported', 'personal']).toContain(source.status)
    }
  })

  it('names the records that carry no source', () => {
    const unsourced = dataset.records.filter(record => record.sources.length === 0)
    expect(unsourced.map(record => record.ids)).toEqual(['⿰言⿱⿰幺幺⿰幺幺', '⿱車🚗'])
    for (const record of unsourced) expect(readme).toContain(record.ids)
    expect(readme).toContain('Two records')
  })

  it('names source terms where the project records them', () => {
    expect(SOURCES.get('babelstone')?.licence).toBe('Public Domain')
    expect(SOURCES.get('en-wp-kokuji')?.licence).toBe('CC BY-SA 4.0')
    expect(readme).toMatch(/\| Key \| Work \| Author \| Date \| Terms \| Status \| URL \|/)
  })

  it('marks the descriptions no source decomposes as editorial', () => {
    const editorial = dataset.records.filter(record => record.editorial)
    expect(editorial).toHaveLength(65)
    for (const record of editorial) expect(['shuishu', 'jurchen', 'ligature']).toContain(record.group)
    expect(editorial.filter(record => record.group === 'ligature')).toHaveLength(3)
    for (const record of dataset.records.filter(record => record.group === 'shuishu' || record.group === 'jurchen')) {
      expect(record.editorial).toBe(true)
    }
  })

  it('writes the same records as a table', () => {
    expect(tsv[0]).toBe('ids\tchar\tcodepoint\tgroup\treading\tmodern\tabbreviates\teditorial\tsources')
    expect(tsv).toHaveLength(dataset.records.length + 1)
    dataset.records.forEach((record, index) => {
      expect(tsv[index + 1].split('\t')).toEqual([
        record.ids, record.char ?? '', record.codepoint ?? '', record.group, record.reading ?? '',
        record.modern ?? '', record.abbreviates ?? '', String(record.editorial), record.sources.join(' '),
      ])
    })
    expect(componentsTsv[0]).toBe('component\tdescription\tfragment\teditorial')
    expect(componentsTsv).toHaveLength(dataset.components.length + 1)
    dataset.components.forEach((component, index) => {
      expect(componentsTsv[index + 1].split('\t')).toEqual([
        component.component, component.description, component.fragment, String(component.editorial),
      ])
    })
  })

  it('carries the kana and Hangul equivalences', () => {
    expect(equivalences.format).toBe('ids-input/equivalences')
    expect(equivalences.version).toBe(1)
    expect(equivalences.counts).toEqual({ kana: 48, hangul: 10 })
    expect(equivalences.kana).toHaveLength(48)
    expect(equivalences.hangul).toHaveLength(10)
    expect(equivalences.kana.find(row => row.shapes[0] === 'マ')).toMatchObject({ components: ['龴', '丅', '丁'] })
    expect(equivalences.hangul.find(row => row.shapes[0] === 'ㅅ')).toMatchObject({ shapes: ['ㅅ', 'ᄉ', 'ᆺ'], components: ['人'] })
    expect(equivalenceTsv[0]).toBe('kind\tshapes\tcomponents')
    expect(equivalenceTsv).toHaveLength(equivalences.kana.length + equivalences.hangul.length + 1)
    expect(equivalenceTsv[1].split('\t')).toEqual(['kana', 'ア', '了 ㇌ 卩 刀 丫'])
    expect(readme).toContain('## Equivalences')
    expect(readme).toContain('equivalences.tsv')
  })

  it('lists the files it ships with their sizes', () => {
    expect(manifest.files.map(file => file.name)).toEqual([
      'descriptions.json', 'descriptions.tsv', 'components.tsv',
      'equivalences.json', 'equivalences.tsv', 'README.md',
    ])
    for (const file of manifest.files) expect(Buffer.byteLength(read(file.name))).toBe(file.bytes)
  })

  it('rebuilds the committed bytes', () => {
    const build = Bun.spawnSync([process.execPath, 'scripts/build_open_ids.mjs', '--check'], { encoding: 'utf8' })
    expect(build.exitCode).toBe(0)
  })
})
