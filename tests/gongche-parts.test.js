import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { GONGCHE_PARTS, GONGCHE_GROUPS, gongcheGroups } from '../src/core/gongche.js'
import { parse } from '../src/core/ids.js'

it('offers selectable Gongche components with accurate stroke metadata', () => {
  const data = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
  expect(GONGCHE_PARTS).toHaveLength(72)
  expect(new Set(GONGCHE_PARTS.map(p => p.part)).size).toBe(72)
  for (const item of GONGCHE_PARTS) {
    expect(parse(item.part, { open: true }).problem).toBeUndefined()
    const row = data.parts.find(row => row[0] === item.part)
    if (row && item.strokes != null) expect(item.strokes).toBe(row[2])
  }
  expect(GONGCHE_GROUPS.find(g => g.key === 'modifiers').parts.map(p => p.part)).toEqual(['亻', '彳', '⿱𰀪亻', '氵', '⿰氵氵', '艹'])
})

it('filters only the Gongche catalogue and retains notation order', () => {
  expect(gongcheGroups('')).toEqual(GONGCHE_GROUPS)
  const parts = query => gongcheGroups(query).flatMap(group => group.parts.map(p => p.part))
  expect(parts('4')).toEqual(['尺', '六', '五', '反', '勾', '𪛛', '𪜧', '𢒼', '㲸', '⿱𰀪亻', '艹'])
  expect(parts('木')).toEqual([])
  expect(parts('  工尺 ')).toEqual(['尺', '工'])
  expect(parts('⿰氵氵')).toEqual(['⿰氵氵'])
})

it('provides every Gongche label and description in all supported locales', () => {
  const common = ['guide','conventions','compose','beiguan','cantonese','kunquSource','marksSource','beiguanSource','seirakuSource']
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
  expect(GONGCHE_GROUPS.filter(g => g.key === 'marks' || g.key === 'rhythm').flatMap(g => g.parts).filter(p => p.part !== '勺').every(p => p.strokes == null)).toBe(true)
})

it('covers every encoded register and staccato form in the audited source tables', () => {
  const literals = new Set(GONGCHE_PARTS.map(p => p.part))
  for (const char of '仩伬仜𠆩𠆾伍亿𱝫鿈𢓁𱝬𢓌鿉𢒼佮仕仮𢓉𪜧洽㲸𰛈沢江汳勺勾凢甲下艹㐅丶‧○×、。｜『』，…*') {
    expect(literals.has(char)).toBe(true)
  }
  for (const ids of ['⿰氵士', '⿰氵六']) expect(literals.has(ids)).toBe(true)
  // Similar-looking characters must not silently replace the score's literal form.
  for (const wrong of ['汢', '勻', 'の', '乛']) expect(literals.has(wrong)).toBe(false)
  for (const item of GONGCHE_PARTS) {
    for (const alias of item.aliases ?? []) {
      expect(parse(alias).problem).toBeUndefined()
      expect(literals.has(alias)).toBe(false)
      expect(gongcheGroups(alias).flatMap(g => g.parts).map(p => p.part)).toContain(item.part)
    }
  }
  expect(gongcheGroups('⿰氵').flatMap(g => g.parts).map(p => p.part)).toEqual(['洽','⿰氵士','㲸','𰛈','沢','江','汳','⿰氵六','⿰氵氵'])
})

it('keeps a source record for every catalogue group', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/gongche-parts.json', import.meta.url)))
  for (const group of catalogue.groups) {
    expect(group.sources.length).toBeGreaterThan(0)
    for (const id of group.sources) {
      expect(catalogue.sources[id].url.startsWith('https://')).toBe(true)
      expect(catalogue.sources[id].locator.length).toBeGreaterThan(10)
    }
  }
})
