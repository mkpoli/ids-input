import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parse } from '../src/core/ids.js'
import { auditStructures, buildCatalog, normalizeStructure, readBundledSources } from '../scripts/build_structure_templates.mjs'

const norm = sequence => normalizeStructure(parse(sequence, { open: true }).tree)
const descriptions = (...texts) => texts.map(text => ({ text, regions: '' }))

describe('template frequency generation', () => {
  it('normalizes equivalent axis association and both grid orientations', () => {
    expect(norm('⿰⬚⿰⬚⬚')).toBe(norm('⿲⬚⬚⬚'))
    expect(norm('⿱⿱⬚⬚⬚')).toBe(norm('⿳⬚⬚⬚'))
    expect(norm('⿳⬚⬚⿱⬚⬚')).toBe(norm('⿱⿱⬚⬚⿱⬚⬚'))
    expect(norm('⿰⿱⬚⬚⿱⬚⬚')).toBe(norm('⿱⿰⬚⬚⿰⬚⬚'))
    expect(norm('⿸⬚⿱⬚⬚')).not.toBe(norm('⿺⬚⿱⬚⬚'))
    expect(norm('⿻⬚⬚')).not.toBe(norm('⿴⬚⬚'))
  })
  it('counts unique characters across alternative descriptions without expanding component names', () => {
    const table = new Map([
      ['甲', descriptions('⿱木⿱口水', '⿳木口水', '⿳木口水')],
      ['乙', descriptions('⿱⿱木口水', '⿳木口水')],
      ['丙', descriptions('⿰木森')],
      ['森', descriptions('⿱木⿰木木')],
      ['丁', descriptions('⿰木？')],
      ['A', descriptions('⿳木口水')],
    ])
    const result = auditStructures(table)
    expect(result.patterns.get(norm('⿳⬚⬚⬚')).characters.size).toBe(2)
    expect(result.patterns.get(norm('⿰⬚⬚')).characters.has('丙')).toBe(true)
    expect(result.patterns.get(norm('⿰⬚⿱⬚⿰⬚⬚'))).toBeUndefined()
    expect(result.totals.hanCharacters).toBe(5)
    expect(result.totals.eligibleCharacters).toBe(4)
    expect(result.totals.unknownDescriptions).toBe(1)
  })
  it('applies the threshold to characters, not descriptions, and excludes semantic transforms from additions', () => {
    const table = new Map([
      ['甲', descriptions('⿰木⿸广林', '⿰水⿸厂口')],
      ['乙', descriptions('⿰火⿸广日')],
      ['丙', descriptions('⿺辶水', '⿺辶木', '⿺辶火')],
      ['丁', descriptions('㇯木口')],
      ['戊', descriptions('㇯火日')],
    ])
    const catalog = buildCatalog(table, [], 2)
    const additions = catalog.templates.filter(item => item.id.startsWith('layout-'))
    expect(additions).toHaveLength(1)
    expect(additions[0].sequence).toBe('⿰⬚⿸⬚⬚')
    expect(additions[0].count).toBe(2)
    expect(additions[0].examples).toEqual(['甲', '乙'])
    expect(catalog.statistics.previousTemplates).toBe(17)
  })
  it('keeps the curated Hangul layout without corpus matches', () => {
    const catalog = buildCatalog(new Map(), [], 50)
    expect(catalog.templates.find(item => item.id === 'hangulFinal')).toEqual({ id: 'hangulFinal', sequence: '⿱⿽⬚⬚⬚', curated: true, slots: 3, count: 0, examples: [] })
    expect(catalog.statistics.previousTemplates).toBe(17)
    expect(catalog.statistics.curatedTemplates).toBe(1)
    expect(catalog.statistics.frequencyAdditions).toBe(0)
    expect(catalog.statistics.coveredCharacters).toBe(0)
  })
  it('reproduces the checked-in catalog from the bundled sources', () => {
    const { table, sources } = readBundledSources()
    const actual = buildCatalog(table, sources)
    const expected = JSON.parse(readFileSync(new URL('../src/core/structure-templates.json', import.meta.url), 'utf8'))
    expect(actual).toEqual(expected)
    expect(actual.statistics.addedTemplates).toBe(39)
    expect(actual.statistics.eligibleCharacters).toBe(100172)
    expect(sources.every(source => source.version && /^[a-f0-9]{64}$/.test(source.compressedSha256) && /^[a-f0-9]{64}$/.test(source.textSha256))).toBe(true)
  })
})
