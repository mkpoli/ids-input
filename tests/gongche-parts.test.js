import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { GONGCHE_PARTS, GONGCHE_GROUPS, gongcheGroups } from '../src/core/gongche.js'
import { parse } from '../src/core/ids.js'

it('offers complete selectable Gongche components with accurate stroke metadata', () => {
  const data = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
  expect(GONGCHE_PARTS).toHaveLength(18)
  expect(new Set(GONGCHE_PARTS.map(p => p.part)).size).toBe(18)
  for (const item of GONGCHE_PARTS) {
    expect(parse(item.part, { open: true }).problem).toBeUndefined()
    expect(item.strokes).toBe(data.parts.find(row => row[0] === item.part)[2])
  }
  expect(GONGCHE_GROUPS.at(-1).parts.map(p => p.part)).toEqual(['亻', '彳', '⿱𰀪亻', '氵', '⿰氵氵'])
})

it('filters only the Gongche catalogue and retains notation order', () => {
  expect(gongcheGroups('')).toEqual(GONGCHE_GROUPS)
  const parts = query => gongcheGroups(query).flatMap(group => group.parts.map(p => p.part))
  expect(parts('4')).toEqual(['尺', '六', '五', '反', '⿱𰀪亻'])
  expect(parts('木')).toEqual([])
  expect(parts('  工尺 ')).toEqual(['尺', '工'])
  expect(parts('⿰氵氵')).toEqual(['⿰氵氵'])
})

it('provides every Gongche label and description in all supported locales', () => {
  const common = ['guide','conventions','compose','beiguan','cantonese']
  for (const lang of ['en','ja','zh-Hans','zh-Hant','ko','vi']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url)))
    expect(messages['parts.tab.gongche']).toBeTruthy()
    for (const key of [...common, ...GONGCHE_GROUPS.map(g => g.key)]) {
      expect(messages[`parts.gongche.${key}`]).toBeTruthy()
    }
  }
})
