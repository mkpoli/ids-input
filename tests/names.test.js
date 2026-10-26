import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createNameSearch, foldName, readNames } from '../src/core/index.js'
import { babelStoneAdapter, paletteRows } from '../src/adapter/index.js'

const NAMES = readFileSync(new URL('../data/component-names.tsv', import.meta.url), 'utf8')
const FORMS = readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8')
const PALETTE = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8')))
const names = readNames(NAMES)
const byName = createNameSearch(names)

const chars = (query, search = byName) => search.search(query).map(hit => hit.char)

describe('a name', () => {
  it('folds katakana, hiragana, width, case, spaces and punctuation together', () => {
    expect(foldName('ノブン')).toBe('のぶん')
    expect(foldName('のぶん')).toBe('のぶん')
    expect(foldName('ノ 木')).toBe('の木')
    expect(foldName('宝蓋・頭')).toBe('宝蓋頭')
    expect(foldName('ＡＢＣ')).toBe('abc')
  })
  it('reads the table, comments and blank lines out', () => {
    expect(readNames('# columns\n\n絞絲\t糸\ttest\tx\n').map(name => [name.name, name.char])).toEqual([['絞絲', '糸']])
    expect(() => readNames('x\tnot a component\ttest\tx\n')).toThrow('is not a component')
  })
})

describe('the name search', () => {
  const small = createNameSearch(readNames([
    '# name\tchar\tsource\tdetail',
    '絞絲旁\t糸\ttest\tzh',
    '绞丝旁\t糸\ttest\tzh',
    'ノ文\t攵\ttest\tja',
    'のぶん\t攵\ttest\tja',
    '宝盖\t宀\ttest\tzh',
    '宝盖头\t宀\ttest\tzh',
    '寶蓋\t宀\ttest\tzh',
    'ノ木偏\t禾\ttest\tja',
    '宝盖头\t宀\tother\tzh',
  ].join('\n')))
  it('finds a name by its whole, its start or a part of it', () => {
    expect(chars('絞絲', small)).toEqual(['糸'])
    expect(chars('绞丝', small)).toEqual(['糸'])
    expect(chars('宝盖', small)).toEqual(['宀'])
    expect(chars('寶蓋', small)).toEqual(['宀'])
    expect(chars('头', small)).toEqual(['宀'])
  })
  it('folds kana and takes the closest name as the label', () => {
    expect(chars('ノブン', small)).toEqual(['攵'])
    expect(small.search('ノブン')[0].label).toBe('のぶん')
    expect(chars('の木', small)).toEqual(['禾'])
  })
  it('keeps one hit per component and names it by the closest name', () => {
    const [hit] = small.search('宝盖')
    expect(hit).toMatchObject({ char: '宀', label: '宝盖' })
    expect(small.search('宝盖').filter(found => found.char === '宀')).toHaveLength(1)
  })
  it('takes a limit and finds nothing for an empty query or no room', () => {
    expect(small.search('').length).toBe(0)
    expect(small.search('の', { limit: 1 })).toHaveLength(1)
    expect(small.search('宝盖', { limit: 0 })).toEqual([])
  })
})

describe('the shipped names', () => {
  it('are more than a thousand, every one for a component', () => {
    expect(names.length).toBeGreaterThan(1000)
    expect(names.every(name => name.name && name.char)).toBe(true)
  })
  it('find the forms people call by name', () => {
    expect(chars('絞絲')).toContain('纟')
    expect(chars('绞丝')).toContain('纟')
    expect(chars('絞絲旁')).toContain('糸')
    expect(chars('ノ文')).toEqual(['攵'])
    expect(chars('ノブン')).toEqual(['攵'])
    expect(chars('のぶん')).toEqual(['攵'])
    expect(chars('ノギ')).toEqual(['禾'])
    expect(chars('のぎ')).toEqual(['禾'])
    expect(chars('ノ木')).toEqual(['禾'])
    expect(chars('の木')).toEqual(['禾'])
    expect(chars('宝盖')[0]).toBe('宀')
    expect(chars('寶蓋')[0]).toBe('宀')
    expect(chars('宝盖头')[0]).toBe('宀')
    expect(chars('三點水')).toContain('水')
    expect(chars('反文旁')).toContain('攵')
    expect(chars('禾木旁')).toContain('禾')
    expect(chars('鱼字旁')).toContain('魚')
    expect(chars('鸟字旁')).toContain('鳥')
    expect(chars('门字框')).toContain('門')
    expect(chars('骨字旁')).toContain('骨')
  })
})

describe('the adapter name search', () => {
  const adapter = babelStoneAdapter({ table: new Map(), namesText: NAMES, formsText: FORMS, palette: PALETTE })
  const found = async query => (await adapter.search(query)).map(item => item.char)

  it('offers the named component and the forms that stand for it', async () => {
    expect(await found('絞絲')).toEqual(expect.arrayContaining(['纟', '糹', '糸']))
    expect((await found('ノ文')).slice(0, 2)).toEqual(['攵', '攴'])
    expect((await found('ノギ'))[0]).toBe('禾')
    expect(await found('宝盖')).toEqual(expect.arrayContaining(['宀', '冖', '穴']))
    expect(await found('三點水')).toEqual(expect.arrayContaining(['水', '氵', '氺']))
    expect(await found('鱼字旁')).toEqual(expect.arrayContaining(['魚', '鱼']))
    expect((await found('宝盖'))[0]).toBe('宀')
  })
  it('puts the names before the characters typed when the query is a name', async () => {
    const hits = await adapter.search('宝盖')
    expect(hits.slice(0, 3).map(hit => hit.char)).toEqual(['宀', '冖', '穴'])
    expect(hits).toEqual(expect.arrayContaining([{ char: '宝', label: 'U+5B9D' }, { char: '盖', label: 'U+76D6' }]))
  })
  it('leaves a single component typed on its own alone', async () => {
    expect(await found('木')).toEqual(['木'])
    expect((await adapter.search('木'))[0].label).toBe('U+6728')
    expect(await adapter.search('宝盖', { limit: 0 })).toEqual([])
  })
  it('still finds a character or a code point without names', async () => {
    const plain = babelStoneAdapter({ table: new Map() })
    expect(await plain.search('木 U+6728')).toEqual([{ char: '木', label: 'U+6728' }])
  })
  it('keeps the characters typed when the names cannot be read', async () => {
    const failed = babelStoneAdapter({ table: new Map(), names: 'missing.tsv', fetch: async () => new Response('', { status: 404 }) })
    expect(await failed.search('木骨')).toEqual([{ char: '木', label: 'U+6728' }, { char: '骨', label: 'U+9AA8' }])
  })
  it('opens a name into the forms only when a forms table is given', async () => {
    const bare = babelStoneAdapter({ table: new Map(), namesText: NAMES, palette: PALETTE })
    const hits = await bare.search('絞絲')
    expect(hits[0]).toEqual({ char: '纟', label: '絞絲' })
    expect(hits.map(hit => hit.char)).not.toContain('糹')
  })
})
