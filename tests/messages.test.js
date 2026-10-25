import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { translator } from '../src/svelte/i18n.js'

const catalogue = name => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'))
const en = catalogue('en')
const LOCALES = ['ja', 'zh-Hans', 'zh-Hant', 'ko']

describe('the message catalogues', () => {
  it('give every key the components use', () => {
    const dir = new URL('../src/svelte/', import.meta.url)
    const used = new Set()
    for (const file of readdirSync(dir).filter(name => name.endsWith('.svelte'))) {
      for (const [, key] of readFileSync(new URL(file, dir), 'utf8').matchAll(/\bt\('([a-z][\w.]+)'/g)) used.add(key)
    }
    const has = key => key in en || `${key}.other` in en
    expect([...used].filter(key => !has(key))).toEqual([])
    for (const name of ['leftRight', 'variant']) expect(`ids.op.${name}` in en).toBe(true)
    for (const tab of ['find', 'parts', 'from']) expect(`ids.pick.${tab}` in en).toBe(true)
  })
  it('hold the same keys in every language, plurals aside', () => {
    const keys = Object.keys(en).filter(key => !key.endsWith('.one'))
    for (const locale of LOCALES) expect(Object.keys(catalogue(locale)).sort()).toEqual(keys.sort())
  })
  it('keep each placeholder of the English text', () => {
    for (const locale of LOCALES) {
      const messages = catalogue(locale)
      for (const [key, text] of Object.entries(messages)) {
        const names = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
        expect([key, names(text)]).toEqual([key, names(en[key])])
      }
    }
  })
})

describe('a translator', () => {
  it('fills placeholders and chooses plurals', () => {
    const t = translator(en, 'en')
    expect(t('ids.choose', { part: '木' })).toBe('Choose 木')
    expect(t('parts.strokeCount', { count: 1 })).toBe('1 stroke')
    expect(t('parts.uses', { count: 1234 })).toBe('used in 1,234 characters')
  })
  it('falls back to English, then to the key', () => {
    const t = translator({ 'ids.use': 'この字形にする' }, 'ja')
    expect(t('ids.use')).toBe('この字形にする')
    expect(t('ids.clear')).toBe('Clear part')
    expect(t('nothing.here')).toBe('nothing.here')
    expect(translator(catalogue('ja'), 'ja')('parts.strokeCount', { count: 1 })).toBe(catalogue('ja')['parts.strokeCount.other'].replace('{count}', '1'))
  })
})
