import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { GONGCHE_PARTS, GONGCHE_GROUPS, gongcheGroups } from '../src/core/gongche.js'
import { parse } from '../src/core/ids.js'

it('offers selectable Gongche components with accurate stroke metadata', () => {
  const data = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
  expect(GONGCHE_PARTS).toHaveLength(31)
  expect(new Set(GONGCHE_PARTS.map(p => p.part)).size).toBe(31)
  for (const item of GONGCHE_PARTS) {
    expect(parse(item.part, { open: true }).problem).toBeUndefined()
    const row = data.parts.find(row => row[0] === item.part)
    if (row) expect(item.strokes).toBe(row[2])
  }
  expect(GONGCHE_GROUPS.find(g => g.key === 'modifiers').parts.map(p => p.part)).toEqual(['亻', '彳', '⿱𰀪亻', '氵', '⿰氵氵'])
})

it('filters only the Gongche catalogue and retains notation order', () => {
  expect(gongcheGroups('')).toEqual(GONGCHE_GROUPS)
  const parts = query => gongcheGroups(query).flatMap(group => group.parts.map(p => p.part))
  expect(parts('4')).toEqual(['尺', '六', '五', '反', '𪛛', '𢒼', '㲸', '⿱𰀪亻'])
  expect(parts('木')).toEqual([])
  expect(parts('  工尺 ')).toEqual(['尺', '工'])
  expect(parts('⿰氵氵')).toEqual(['⿰氵氵'])
})

it('provides every Gongche label and description in all supported locales', () => {
  const common = ['guide','conventions','compose','beiguan','cantonese','kunquSource','marksSource']
  for (const lang of ['en','ja','zh-Hans','zh-Hant','ko','vi']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url)))
    expect(messages['parts.tab.gongche']).toBeTruthy()
    for (const key of [...common, ...GONGCHE_GROUPS.map(g => g.key)]) {
      expect(messages[`parts.gongche.${key}`]).toBeTruthy()
    }
  }
})

it('preserves encoded notes and literal punctuation without invented stroke counts', () => {
  const forms = gongcheGroups('𪛗𪛘𪛙𪛚𪛛𪛜𪛝𢒼㲸').flatMap(g => g.parts)
  expect(forms.map(p => p.strokes)).toEqual([6,5,1,3,4,3,3,4,4])
  for (const char of '生𪛗𪛘𪛙𪛚𪛛𪛜𪛝𢒼㲸｜『』') {
    expect(gongcheGroups(char).flatMap(g => g.parts.map(p => p.part))).toEqual([char])
    expect(parse(`⿰${char}工`).tree.parts[0]).toBe(char)
  }
  expect(GONGCHE_GROUPS.find(g => g.key === 'marks').parts.every(p => p.strokes == null)).toBe(true)
})
