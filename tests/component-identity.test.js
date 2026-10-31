import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { adjacentStrokeForms, componentIdentity, familyPoint, isStroke, IDENTITY_SOURCES, IDENTITY_UNICODE_VERSION } from '../src/core/component-identity.js'
import table from '../src/core/component-identity.json' with { type: 'json' }

const part = (text, uses, extra = {}) => ({ part: text, kind: 'c', ...(uses === undefined ? {} : { uses }), ...extra })

it('names a stroke, the radicals beside it and the ideograph they are equivalent to', () => {
  expect(componentIdentity('㇐')).toEqual({
    type: 'stroke', name: 'CJK STROKE H', strokeName: 'horizontal', equivalents: ['一', '⼀'],
    sources: componentIdentity('㇐').sources,
  })
  expect(componentIdentity('一')).toMatchObject({ type: 'ideograph', name: 'CJK UNIFIED IDEOGRAPH-4E00', equivalents: ['⼀', '㇐'] })
  expect(componentIdentity('⼀')).toMatchObject({ type: 'radical', name: 'KANGXI RADICAL ONE', equivalents: ['一', '㇐'] })
  expect(componentIdentity('⼀').strokeName).toBeUndefined()
  for (const component of '㇐一⼀') expect(familyPoint(component)).toBe('4E00')
})

it('keeps the two 丿 strokes in one family and reads their names apart', () => {
  expect(componentIdentity('㇒')).toMatchObject({ type: 'stroke', name: 'CJK STROKE P', strokeName: 'left-falling', equivalents: ['丿', '⼃', '㇓'] })
  expect(componentIdentity('㇓')).toMatchObject({ type: 'stroke', name: 'CJK STROKE SP', strokeName: 'vertical left-falling', equivalents: ['丿', '⼃', '㇒'] })
  expect(componentIdentity('丿')).toMatchObject({ type: 'ideograph', equivalents: ['⼃', '㇒', '㇓'] })
})

it('joins 乙 with its CJK radical, its Kangxi radical and its stroke', () => {
  expect(componentIdentity('⺄')).toMatchObject({ type: 'radical', name: 'CJK RADICAL SECOND THREE', equivalents: ['乙', '⼄', '㇠'] })
  expect(componentIdentity('㇠')).toMatchObject({ type: 'stroke', name: 'CJK STROKE HXWG', strokeName: 'horizontal slanted curve hook', equivalents: ['乙', '⺄', '⼄'] })
  expect(componentIdentity('乙')).toMatchObject({ type: 'ideograph', equivalents: ['⺄', '⼄', '㇠'] })
  expect(componentIdentity('乚')).toMatchObject({ type: 'ideograph', equivalents: ['⺃', '㇟'] })
  expect(componentIdentity('㇟')).toMatchObject({ type: 'stroke', name: 'CJK STROKE SWG', strokeName: 'vertical curve hook' })
})

it('reports strokes Unicode records no equivalent ideograph for, and nothing for the subtraction operator', () => {
  for (const [stroke, name, english] of [['㇄', 'CJK STROKE SW', 'vertical curve'], ['㇣', 'CJK STROKE Q', 'circle']]) {
    expect(componentIdentity(stroke)).toEqual({
      type: 'stroke', name, strokeName: english, equivalents: [],
      sources: componentIdentity(stroke).sources,
    })
    expect(componentIdentity(stroke).sources.some(source => source.url.includes('EquivalentUnifiedIdeograph'))).toBe(false)
    expect(familyPoint(stroke)).toBe(null)
    expect(isStroke(stroke)).toBe(true)
  }
  expect(componentIdentity('㇯')).toBe(null)
  expect(isStroke('㇯')).toBe(false)
  expect('31EF' in table.names).toBe(false)
  for (const component of ['', '木口', '⿰木口', '〇', 'A']) expect(componentIdentity(component)).toBe(null)
  for (const component of '乁𠃉𬼂鬱') expect(componentIdentity(component)).toMatchObject({ type: 'ideograph', equivalents: [] })
  expect(componentIdentity('﨑').name).toBe('CJK COMPATIBILITY IDEOGRAPH-FA11')
})

it('cites Unicode names and the Appendix F editions used for stroke readings', () => {
  expect(IDENTITY_UNICODE_VERSION).toBe('18.0.0')
  expect(IDENTITY_SOURCES.every(source => source.url.startsWith('https://') && source.label)).toBe(true)
  expect(IDENTITY_SOURCES.filter(source => source.sha256).length).toBe(2)
  expect(componentIdentity('㇐').sources.map(source => source.url)).toEqual([
    'https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt',
    'https://www.unicode.org/versions/Unicode18.0.0/core-spec/chapter-18/',
    'https://www.unicode.org/versions/Unicode15.1.0/appF.pdf',
    'https://github.com/mkpoli/ids-input/blob/main/src/core/component-identity.js',
    'https://www.unicode.org/Public/18.0.0/ucd/EquivalentUnifiedIdeograph.txt',
  ])
  expect(table.strokes['31E4'].pinyinTier).toBe('appendix-f-18')
  expect(table.strokes['31E5'].pinyinTier).toBe('appendix-f-18')
  for (const char of '㇤㇥') expect(componentIdentity(char).sources.some(source => source.url.endsWith('Unicode18.0.0/core-spec/appendix-f/'))).toBe(true)
  expect(Object.values(table.strokes).every(stroke => stroke.pinyinTier.startsWith('appendix-f'))).toBe(true)
})

it('matches the pinned UnicodeData names and covers every stroke and radical once', () => {
  const lines = gunzipSync(readFileSync(new URL('../data/unicode-18.0.0/UnicodeData.txt.gz', import.meta.url))).toString().trim().split('\n')
  const names = new Map(lines.map(line => line.split(';')).map(([hex, name]) => [hex, name]))
  const ideographs = []
  let start = 0
  for (const [hex, name] of lines.map(line => line.split(';'))) {
    if (name.endsWith(', First>')) start = parseInt(hex, 16)
    else if (name.endsWith(', Last>') && name.includes('CJK Ideograph')) ideographs.push([start, parseInt(hex, 16)])
  }
  for (const [hex, name] of Object.entries(table.names)) expect(name).toBe(names.get(hex))
  for (const [hex, stroke] of Object.entries(table.strokes)) {
    expect(names.get(hex)).toBe(`CJK STROKE ${stroke.acronym}`)
    expect(stroke.english.split(' ').length).toBe(stroke.pinyin.split('-').length)
  }
  const assigned = []
  for (let cp = 0x2e80; cp <= 0x2fdf; cp++) if (names.has(cp.toString(16).toUpperCase())) assigned.push(cp.toString(16).toUpperCase())
  for (let cp = 0x31c0; cp <= 0x31e5; cp++) assigned.push(cp.toString(16).toUpperCase())
  expect(Object.keys(table.strokes).length).toBe(0x31e5 - 0x31c0 + 1)
  expect(new Set(Object.keys(table.names))).toEqual(new Set(assigned))
  const members = Object.values(table.families).flat()
  expect(new Set(members).size).toBe(members.length)
  expect(new Set([...members, ...table.unmapped])).toEqual(new Set(assigned))
  for (const [ideograph, family] of Object.entries(table.families)) {
    const cp = parseInt(ideograph, 16)
    expect(ideographs.some(([first, last]) => cp >= first && cp <= last)).toBe(true)
    expect(family).toEqual([...family].sort())
    expect(family.every(member => assigned.includes(member))).toBe(true)
  }
})

it('groups a palette one-stroke family at its first position, most used first, without touching the parts', () => {
  const rows = [part('木', 900), part('㇐', 2), part('丿', 40), part('一', 500), part('㇒', 3), part('⼀', 1), part('火', 800)]
  const snapshot = rows.map(row => ({ ...row }))
  const ordered = adjacentStrokeForms(rows)
  expect(ordered.map(row => row.part)).toEqual(['木', '一', '㇐', '⼀', '丿', '㇒', '火'])
  expect(ordered[1]).toBe(rows[3])
  expect(ordered[2]).toBe(rows[1])
  expect(rows.map(row => ({ ...row }))).toEqual(snapshot)
  expect(adjacentStrokeForms(ordered)).toEqual(ordered)
  expect(new Set(adjacentStrokeForms(rows))).toEqual(new Set(rows))
})

it('breaks ties by the order given and keeps ordinary variant families where the palette put them', () => {
  const ties = [part('㇒'), part('丿'), part('㇓'), part('⼃')]
  expect(adjacentStrokeForms(ties).map(row => row.part)).toEqual(['㇒', '丿', '㇓', '⼃'])
  const variants = [part('釒', 10), part('水', 700), part('钅', 30), part('金', 400), part('⾦', 1), part('氵', 600)]
  expect(adjacentStrokeForms(variants)).toEqual(variants)
  expect(adjacentStrokeForms(variants).map(row => row.part)).toEqual(['釒', '水', '钅', '金', '⾦', '氵'])
})

it('groups only what a filtered palette shows', () => {
  const rows = [part('木', 900), part('㇐', 2), part('一', 500), part('⼀', 1), part('丿', 40), part('㇒', 3)]
  for (const subset of [[0, 2, 3], [0, 4], [1, 5], [0, 1, 2]]) {
    const selected = subset.map(at => rows[at])
    const ordered = adjacentStrokeForms(selected)
    expect(new Set(ordered)).toEqual(new Set(selected))
    expect(ordered.length).toBe(selected.length)
  }
  expect(adjacentStrokeForms([rows[0], rows[2], rows[3]])).toEqual([rows[0], rows[2], rows[3]])
  expect(adjacentStrokeForms([rows[0], rows[1], rows[2]]).map(row => row.part)).toEqual(['木', '一', '㇐'])
  expect(adjacentStrokeForms([])).toEqual([])
})
