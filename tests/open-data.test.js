// The open data release: a table a reader can reuse without this package, built from the starter
// catalogue and checked to say what it holds.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { OPERATORS, parse } from '../src/core/index.js'

const read = name => readFileSync(new URL(`../data/open-data/${name}`, import.meta.url), 'utf8')
const dataset = JSON.parse(read('descriptions.json'))
const manifest = JSON.parse(read('manifest.json'))
const tsv = read('descriptions.tsv').trimEnd().split('\n')
const componentsTsv = read('components.tsv').trimEnd().split('\n')
const OPERATOR = new Set(OPERATORS.map(([operator]) => operator))
const SOURCES = new Map(dataset.sources.map(source => [source.key, source]))

describe('the open data release', () => {
  it('names its format, version and licence', () => {
    expect(dataset.format).toBe('ids-input/open-ids')
    expect(dataset.version).toBe(1)
    expect(dataset.licence.spdx).toBe('CC0-1.0')
    expect(dataset.licence.url).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
    expect(read('README.md')).toContain(dataset.licence.url)
  })

  it('counts what it holds', () => {
    expect(dataset.counts.descriptions).toBe(dataset.records.length)
    expect(dataset.counts.unencoded).toBe(dataset.records.filter(record => !record.char).length)
    expect(dataset.counts.editorial).toBe(dataset.records.filter(record => record.editorial).length)
    expect(dataset.counts.groups).toBe(dataset.groups.length)
    expect(dataset.counts.sources).toBe(dataset.sources.length)
    expect(dataset.counts.components).toBe(dataset.components.length)
    expect(manifest.counts).toEqual(dataset.counts)
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

  it('cites a source for each record and uses each source it lists', () => {
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

  it('marks the Shuishu and Jurchen readings as editorial', () => {
    for (const record of dataset.records) {
      expect(record.editorial).toBe(record.group === 'shuishu' || record.group === 'jurchen')
    }
    expect(dataset.records.filter(record => record.editorial)).toHaveLength(62)
  })

  it('writes the same records as a table', () => {
    expect(tsv[0]).toBe('ids\tchar\tcodepoint\tgroup\treading\tmodern\tabbreviates\teditorial\tsources')
    expect(tsv).toHaveLength(dataset.records.length + 1)
    dataset.records.forEach((record, index) => {
      const cells = tsv[index + 1].split('\t')
      expect(cells[0]).toBe(record.ids)
      expect(cells[1]).toBe(record.char ?? '')
      expect(cells[3]).toBe(record.group)
      expect(cells[7]).toBe(String(record.editorial))
      expect(cells[8]).toBe(record.sources.join(' '))
    })
    expect(componentsTsv[0]).toBe('component\tdescription\tfragment\teditorial')
    expect(componentsTsv).toHaveLength(dataset.components.length + 1)
  })

  it('lists the files it ships with their sizes', () => {
    expect(manifest.files.map(file => file.name)).toEqual(['descriptions.json', 'descriptions.tsv', 'components.tsv', 'README.md'])
    for (const file of manifest.files) expect(Buffer.byteLength(read(file.name))).toBe(file.bytes)
  })

  it('rebuilds the committed bytes', () => {
    const build = Bun.spawnSync([process.execPath, 'scripts/build_open_ids.mjs', '--check'], { encoding: 'utf8' })
    expect(build.exitCode).toBe(0)
  })
})
