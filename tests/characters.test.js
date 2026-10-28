import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createNameSearch, readFolds, readNames } from '../src/core/index.js'
import { babelStoneAdapter, paletteRows } from '../src/adapter/index.js'

const TEXT = gunzipSync(readFileSync(new URL('../data/character-vocabulary.tsv.gz', import.meta.url))).toString('utf8')
const FOLDS = readFileSync(new URL('../data/component-name-folds.tsv', import.meta.url), 'utf8')
const PALETTE = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8')))
const names = readNames(TEXT)
const byName = createNameSearch(names, { folds: readFolds(FOLDS) })
const chars = query => byName.search(query).map(hit => hit.char)

describe('the character vocabulary', () => {
  it('holds every named IDS character and its readings', () => {
    expect(names.length).toBeGreaterThan(200_000)
    expect(new Set(names.map(name => name.char)).size).toBeGreaterThan(45_000)
  })
  it('finds a character by an English meaning, pinyin, kana, romaji, Korean or Vietnamese reading', () => {
    expect(chars('water')[0]).toBe('水')
    expect(chars('shui')[0]).toBe('水')
    expect(chars('mizu')[0]).toBe('水')
    expect(chars('みず')[0]).toBe('水')
    expect(chars('수')).toContain('水')
    expect(chars('thuy')[0]).toBe('水')
    expect(chars('person')[0]).toBe('人')
    expect(chars('silk')[0]).toBe('糸')
    expect(chars('gold')[0]).toBe('金')
    expect(chars('appearance')).toContain('㒵')
    expect(chars('hillock or mound')).toContain('㐀')
  })
})

describe('the adapter character search', () => {
  const adapter = babelStoneAdapter({ table: new Map(), charactersText: TEXT, foldsText: FOLDS, palette: PALETTE })
  const found = async query => (await adapter.searchCharacters(query)).map(item => item.char)

  it('returns the character named, without opening it into component forms', async () => {
    expect((await found('water'))[0]).toBe('水')
    expect((await found('mizu'))[0]).toBe('水')
    expect(await found('수')).toContain('水')
    expect((await found('thuy'))[0]).toBe('水')
    expect((await found('silk'))[0]).toBe('糸')
  })
  it('takes a limit, an empty query and no character data', async () => {
    expect(await adapter.searchCharacters('water', { limit: 0 })).toEqual([])
    expect(await adapter.searchCharacters('')).toEqual([])
    const plain = babelStoneAdapter({ table: new Map() })
    expect(plain.searchCharacters).toBeUndefined()
  })
})
