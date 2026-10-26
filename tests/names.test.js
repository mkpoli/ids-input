import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createNameSearch, foldName, readFolds, readNames } from '../src/core/index.js'
import { babelStoneAdapter, paletteRows } from '../src/adapter/index.js'

const NAMES = readFileSync(new URL('../data/component-names.tsv', import.meta.url), 'utf8')
const FOLDS = readFileSync(new URL('../data/component-name-folds.tsv', import.meta.url), 'utf8')
const FORMS = readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8')
const PALETTE = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8')))
const names = readNames(NAMES)
const folds = readFolds(FOLDS)
const byName = createNameSearch(names, { folds })

const chars = (query, search = byName) => search.search(query).map(hit => hit.char)

describe('a name', () => {
  it('folds katakana, hiragana, width, case, spaces, accents and punctuation together', () => {
    expect(foldName('ノブン')).toBe('のぶん')
    expect(foldName('のぶん')).toBe('のぶん')
    expect(foldName('ノ 木')).toBe('の木')
    expect(foldName('宝蓋・頭')).toBe('宝蓋頭')
    expect(foldName('ＡＢＣ')).toBe('abc')
    expect(foldName('shuǐ')).toBe('shui')
    expect(foldName('thủy')).toBe('thuy')
    expect(foldName('Bộ Thủy')).toBe('bothuy')
    expect(foldName('が')).toBe('が')
    expect(foldName('ガ')).toBe('が')
  })
  it('folds the characters a folds table gives it', () => {
    const table = new Map([['寶', '宝'], ['蓋', '盖'], ['糹', '糸']])
    expect(foldName('寶蓋', table)).toBe('宝盖')
    expect(foldName('糹部', table)).toBe('糸部')
  })
  it('reads the tables, comments and blank lines out', () => {
    expect(readNames('# columns\n\n絞絲\t糸\ttest\tx\n').map(name => [name.name, name.char])).toEqual([['絞絲', '糸']])
    expect(() => readNames('x\tnot a component\ttest\tx\n')).toThrow('is not a component')
    expect([...readFolds('寶\t宝\ttest\n')]).toEqual([['寶', '宝']])
    expect(() => readFolds('寶\tnot a component\ttest\n')).toThrow('is not a component')
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
    'water\t水\ttest\ten',
    'waterfall\t川\ttest\ten',
    'type of caldron with three hollow legs\t鬲\ttest\ten',
    'radical 120\t糸\ttest\ten',
  ].join('\n')), { folds: new Map([['寶', '宝'], ['蓋', '盖'], ['ノ', 'の']]) })
  it('finds a name by its whole, its start or a part of it', () => {
    expect(chars('絞絲', small)).toEqual(['糸'])
    expect(chars('绞丝', small)).toEqual(['糸'])
    expect(chars('宝盖', small)).toEqual(['宀'])
    expect(chars('寶蓋', small)).toEqual(['宀'])
    expect(chars('宝蓋', small)).toEqual(['宀'])
    expect(chars('头', small)).toEqual(['宀'])
  })
  it('folds kana and takes the closest name as the label', () => {
    expect(chars('ノブン', small)).toEqual(['攵'])
    expect(small.search('ノブン')[0].label).toBe('のぶん')
    expect(chars('の木', small)).toEqual(['禾'])
  })
  it('takes a whole Latin word alone, and only the start of one when no whole word fits', () => {
    expect(chars('water', small)).toEqual(['水'])
    expect(chars('Water', small)).toEqual(['水'])
    expect(chars('waterf', small)).toEqual(['川'])
    expect(chars('caldron', small)).toEqual(['鬲'])
    expect(chars('radical', small)).toEqual([])
    expect(chars('radical 120', small)).toEqual(['糸'])
    expect(small.search('a')).toEqual([])
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
    expect(folds.size).toBeGreaterThan(500)
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
  it('find a name through either Chinese script, mixed or whole', () => {
    for (const query of ['寶蓋', '宝盖', '寶盖', '宝蓋']) expect(chars(query)[0]).toBe('宀')
    for (const query of ['龍部', '龙部', '竜部']) expect(chars(query)[0]).toBe('龍')
    for (const query of ['龜部', '龟部', '亀部']) expect(chars(query)[0]).toBe('龜')
    for (const query of ['齊部', '齐部', '斉部']) expect(chars(query)[0]).toBe('齊')
    for (const query of ['齒部', '齿部', '歯部']) expect(chars(query)[0]).toBe('齒')
    for (const query of ['戶部', '户部', '戸部']) expect(chars(query)[0]).toBe('戶')
    for (const query of ['糹部', '糸部', '纟部']) expect(chars(query)[0]).toBe('糸')
    for (const query of ['氵部', '水部']) expect(chars(query)[0]).toBe('水')
  })
  it('find a component by words, readings, pinyin and romaji', () => {
    expect(chars('water')[0]).toBe('水')
    expect(chars('silk')[0]).toBe('糸')
    expect(chars('roof')[0]).toBe('宀')
    expect(chars('thread')[0]).toBe('糸')
    expect(chars('person')[0]).toBe('人')
    expect(chars('mizu')).toEqual(['水'])
    expect(chars('sui')).toContain('水')
    expect(chars('nogi')[0]).toBe('禾')
    expect(chars('nobun')[0]).toBe('攵')
    expect(chars('ukanmuri')[0]).toBe('宀')
    expect(chars('nogihen')[0]).toBe('禾')
    expect(chars('sanzui')[0]).toBe('水')
    expect(chars('jiaosipang')[0]).toBe('糸')
    expect(chars('baogaitou')[0]).toBe('宀')
    expect(chars('sandianshui')[0]).toBe('水')
    expect(chars('shui')[0]).toBe('水')
    expect(chars('sitamizu')[0]).toBe('水')
    expect(chars('nuzipang')[0]).toBe('女')
    expect(chars('nvzipang')[0]).toBe('女')
    expect(chars('caldron')[0]).toBe('鬲')
    expect(chars('radical 120')[0]).toBe('糸')
    expect(chars('Kangxi radical 120')[0]).toBe('糸')
    expect(chars('倒八')[0]).toBe('丷')
    expect(chars('卷字头')[0]).toBe('龹')
    expect(chars('石字头')[0]).toBe('丆')
    expect(chars('仓字底')[0]).toBe('㔾')
    expect(chars('수')).toContain('水')
    expect(chars('사람인')[0]).toBe('人')
    expect(chars('들입')[0]).toBe('入')
    expect(chars('들입')).not.toContain('八')
    expect(names.some(name => name.name.includes('部首索引'))).toBe(false)
    expect(chars('thuy')[0]).toBe('水')
    expect(chars('bộ thủy')[0]).toBe('水')
    expect(chars('radical')).toEqual([])
    expect(chars('斗部')[0]).toBe('斗')
    expect(chars('鬥部')[0]).toBe('鬥')
    expect(chars('鬥字旁')[0]).toBe('鬥')
    expect(chars('幹部')).not.toContain('干')
    expect(chars('幾部')).not.toContain('几')
    expect(names.some(name => name.name === '鬥部' && name.char === '斗')).toBe(false)
    expect(names.some(name => name.name === '斗部' && name.char === '鬥')).toBe(false)
    expect(folds.get('鬥')).toBeUndefined()
  })
})

describe('the adapter name search', () => {
  const adapter = babelStoneAdapter({ table: new Map(), namesText: NAMES, formsText: FORMS, foldsText: FOLDS, palette: PALETTE })
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
  it('offers the forms of a component found through either script', async () => {
    for (const query of ['寶蓋', '宝盖', '寶盖', '宝蓋']) expect((await found(query))[0]).toBe('宀')
    for (const query of ['龍部', '龙部', '竜部']) expect((await found(query))[0]).toBe('龍')
    expect((await found('糹部'))[0]).toBe('糸')
    expect((await found('氵部'))[0]).toBe('水')
  })
  it('finds vocabulary, readings, pinyin and romaji, common components first', async () => {
    expect((await found('water'))[0]).toBe('水')
    expect(await found('water')).toEqual(expect.arrayContaining(['水', '氵', '氺']))
    expect((await found('silk'))[0]).toBe('糸')
    expect(await found('silk')).toEqual(expect.arrayContaining(['糸', '糹', '纟']))
    expect((await found('person'))[0]).toBe('人')
    expect((await found('sui'))[0]).toBe('水')
    expect(await found('mizu')).toEqual(['水', '氵', '氺'])
    expect((await found('nobun'))[0]).toBe('攵')
    expect((await found('nogi'))[0]).toBe('禾')
    expect((await found('jiaosipang'))[0]).toBe('糸')
    expect((await found('sitamizu'))[0]).toBe('水')
    expect((await found('nuzipang'))[0]).toBe('女')
    expect((await found('nvzipang'))[0]).toBe('女')
    expect((await found('caldron'))[0]).toBe('鬲')
    expect((await found('radical 120'))[0]).toBe('糸')
    expect((await found('Kangxi radical 120'))[0]).toBe('糸')
    expect((await found('倒八'))[0]).toBe('丷')
    expect((await found('卷字头'))[0]).toBe('龹')
    expect((await found('石字头'))[0]).toBe('丆')
    expect((await found('仓字底'))[0]).toBe('㔾')
    expect((await found('수'))[0]).toBe('水')
    expect((await found('사람인'))[0]).toBe('人')
    expect((await found('들입'))[0]).toBe('入')
    expect((await found('bộ thủy'))[0]).toBe('水')
    expect(await found('bộ thủy')).not.toContain('ộ')
    expect(await found('radical')).toEqual([])
    expect(await found('斗部')).toEqual(expect.arrayContaining(['斗', '部']))
    expect(await found('斗部')).not.toContain('鬥')
    expect(await found('鬥部')).toContain('鬥')
    expect(await found('鬥部')).not.toContain('斗')
  })
  it('leaves a single component typed on its own alone', async () => {
    expect(await found('木')).toEqual(['木'])
    expect((await adapter.search('木'))[0].label).toBe('U+6728')
    expect(await found('ノ')).toEqual(['ノ'])
    expect(await adapter.search('宝盖', { limit: 0 })).toEqual([])
  })
  it('still finds a character or a code point without names', async () => {
    const plain = babelStoneAdapter({ table: new Map() })
    expect(await plain.search('木 U+6728')).toEqual([{ char: '木', label: 'U+6728' }])
    for (const [query, char] of [['木ｺ', 'ｺ'], ['木𛀀', '𛀀'], ['木ㆠ', 'ㆠ']]) {
      expect((await plain.search(query)).map(item => item.char)).toEqual(['木', char])
    }
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
