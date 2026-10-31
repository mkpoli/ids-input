import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { translator } from '../src/svelte/i18n.js'
import { STRUCTURAL_PRESETS } from '../src/core/structural-search.js'

const catalogue = name => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'))
const en = catalogue('en')

describe('the message catalogues', () => {
  it('hold the keys the components build at runtime', () => {
    for (const name of ['leftRight', 'variant']) expect(`ids.op.${name}` in en).toBe(true)
    for (const tab of ['find', 'parts', 'from', 'templates']) expect(`ids.pick.${tab}` in en).toBe(true)
    for (const key of ['ids.search.label', 'ids.search.none']) expect(key in en).toBe(true)
    for (const name of ['en', 'ja', 'ko', 'vi', 'zh-Hans', 'zh-Hant']) {
      const messages = catalogue(name)
      for (const preset of STRUCTURAL_PRESETS) expect(`ids.structural.${preset.id}` in messages, `${name}: ${preset.id}`).toBe(true)
      for (const key of ['generatorPart', 'repeatCustom', 'repeatAdd', 'repeatRowsHint', 'repeatRowsInvalid', 'five', 'fiveHost', 'fiveHostHint', 'fiveInsert', 'fiveInsertEnclosed', 'fiveUnsupported', 'fiveHostUnsupported', 'fiveTooLong', 'fiveTarget'])
        expect(`ids.templates.${key}` in messages, `${name}: ${key}`).toBe(true)
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

describe('Vietnamese workshop messages', () => {
  it('registers both catalogs and formats Vietnamese counts', async () => {
    const { LOCALES, appMessages } = await import('../demo/lib/locales.js')
    const [, label, messages] = LOCALES.find(([code]) => code === 'vi')
    expect(label).toBe('Tiếng Việt')
    const t = translator({ ...messages, ...appMessages('vi') }, 'vi')
    expect(t('app.title')).toBe('Xưởng IDS')
    for (const count of [0, 1, 2, 1234]) {
      const number = new Intl.NumberFormat('vi').format(count)
      expect(t('parts.strokeCount', { count })).toBe(`${number} nét`)
      expect(t('app.codePoints', { count })).toBe(`${number} điểm mã`)
    }
  })
})
