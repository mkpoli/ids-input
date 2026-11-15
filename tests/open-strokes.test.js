// The open stroke-order release: files that say where every row comes from, checked against the
// manifest that describes them.
import { describe, expect, it } from 'bun:test'
import { readFileSync, statSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const at = name => new URL(`../data/open-strokes/${name}`, import.meta.url)
const manifest = JSON.parse(readFileSync(at('manifest.json'), 'utf8'))
const readme = readFileSync(at('README.md'), 'utf8')
const table = name => gunzipSync(readFileSync(at(name))).toString().replace(/\n$/, '').split('\n').map(line => line.split('\t'))
const rime = table('rime-stroke.tsv.gz'), cns = table('cns11643.tsv.gz'), induced = table('induced.tsv.gz'), kanjivg = table('kanjivg.tsv.gz')
const plain = name => readFileSync(at(name), 'utf8').replace(/\n$/, '').split('\n').map(line => line.split('\t'))
const entered = plain('entered.tsv'), wanted = plain('wanted.tsv'), evidence = plain('within.tsv')
const orders = rows => new Map(rows.slice(1).map(row => [row[0], row[2].split(' ')]))
const digits = code => [...code].map(letter => ({ h: '1', s: '2', p: '3', n: '4', z: '5' })[letter]).join('')
const twins = new Map(readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8').split('\n').map(line => line.split('\t')).filter(row => row[2] === 'unicode-ucd' && row[3] === 'EquivalentUnifiedIdeograph').map(row => [row[0], row[1]]))
// The component each radical form is drawn as, and whether it has that component's outline.
const shapes = new Map(readFileSync(new URL('../data/stroke-form-names.tsv', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('\t')).map(row => [row[0], { name: row[1], shape: row[2] }]))
const point = char => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`

describe('the open stroke-order release', () => {
  it('names its format, sources and their terms', () => {
    expect(manifest.format).toBe('ids-input/open-strokes')
    expect(manifest.version).toBe(3)
    expect(manifest.sources.map(source => source.key)).toEqual(['cns11643', 'rime-stroke', 'kanjivg', 'babelstone-ids', 'unicode-ucd', 'yi-bai-ids'])
    for (const source of manifest.sources) {
      expect(source.url).toMatch(/^https:/)
      expect(source.licence.spdx ?? source.licence.name).toBeTruthy()
      expect(readme).toContain(source.url)
    }
    expect(readme).toContain('LGPL-3.0')
    // The LGPL's text travels with the data, and the README says the table was changed.
    for (const name of manifest.texts) expect(statSync(at(name)).size).toBeGreaterThan(0)
    expect(manifest.texts).toContain('LICENSE-rime-stroke-LGPL-3.0.txt')
    expect(readme).toContain('modified form')
    expect(readme).toContain('數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。')
  })

  it('lists each file with its rows, columns and size', () => {
    for (const [file, rows] of [['rime-stroke.tsv.gz', rime], ['cns11643.tsv.gz', cns], ['induced.tsv.gz', induced], ['kanjivg.tsv.gz', kanjivg], ['entered.tsv', entered], ['wanted.tsv', wanted]]) {
      const entry = manifest.files.find(entry => entry.name === file)
      expect(rows[0]).toEqual(entry.columns)
      expect(rows.length - 1).toBe(entry.rows)
      expect(statSync(at(file)).size).toBe(entry.bytes)
      expect(rows.every(row => row.length === entry.columns.length)).toBe(true)
      expect(rows.slice(1).every(row => [...row[0]].length === 1 && row[1] === point(row[0]))).toBe(true)
    }
  })

  it('keeps each source in its own symbols, Han characters only', () => {
    expect(rime.slice(1).every(row => /^[hspnz]+( [hspnz]+)*$/.test(row[2]))).toBe(true)
    expect(cns.slice(1).every(row => /^[1-5]+( [1-5]+)*$/.test(row[2]) && /^\d+-[0-9A-F]{4}( \d+-[0-9A-F]{4})*$/.test(row[3]))).toBe(true)
    for (const rows of [rime, cns, induced]) expect(rows.slice(1).some(row => /\p{Script=Tangut}/u.test(row[0]))).toBe(false)
    expect(orders(rime).get('王')).toEqual(['hhsh'])
    expect(orders(cns).get('王')).toEqual(['1121'])
  })

  it('keeps KanjiVG\'s stroke types beside the five-class reading of them', () => {
    expect(kanjivg.length - 1).toBeGreaterThan(6500)
    for (const [, , written, strokes] of kanjivg.slice(1)) {
      expect(written).toMatch(/^[1-5]+$/)
      // One type per stroke, each a CJK stroke character with KanjiVG's own marks after it.
      const types = strokes.split(' ')
      expect(types.length).toBe(written.length)
      expect(types.every(type => /^[㇀-㇣]/u.test(type))).toBe(true)
    }
    const japanese = orders(kanjivg)
    // Japanese order: 右 begins with the falling stroke, 王 writes its vertical second.
    expect(japanese.get('右')).toEqual(['31251'])
    expect(japanese.get('王')).toEqual(['1211'])
    expect(orders(cns).get('王')).toEqual(['1121'])
    expect(manifest.texts).toContain('LICENSE-kanjivg-CC-BY-SA-3.0.txt')
    expect(readme).toContain('Ulrich Apel')
  })

  it('says how far the two sources agree', () => {
    const a = orders(cns), b = orders(rime)
    const shared = [...a.keys()].filter(char => b.has(char))
    expect(manifest.agreement.shared).toBe(shared.length)
    expect(manifest.agreement.sameOrder).toBe(shared.filter(char => b.get(char).some(code => a.get(char).includes(digits(code)))).length)
    expect(manifest.agreement.blocks.reduce((sum, row) => sum + row.shared, 0)).toBe(shared.length)
    // The Rime table is the CNS one for most of what both record.
    expect(manifest.agreement.sameOrder / manifest.agreement.shared).toBeGreaterThan(0.98)
    expect(readme).toContain(manifest.agreement.sameOrder.toLocaleString('en'))
  })

  it('marks every induced row with its basis and the source it is written from', () => {
    const tables = { 'rime-stroke': orders(rime), cns11643: orders(cns), kanjivg: orders(kanjivg) }
    const enteredFor = key => new Map(entered.slice(1).filter(row => row[5] === key).map(row => [row[0], row[2].split(' ')]))
    const own = Object.fromEntries(Object.keys(tables).map(key => [key, new Map([...enteredFor(key), ...tables[key]])]))
    const inSymbols = (code, key) => key === 'rime-stroke' ? [...code].map(symbol => 'hspnz'['12345'.indexOf(symbol)] ?? symbol).join('') : /[hspnz]/.test(code) ? digits(code) : code
    const givenIn = Object.fromEntries(Object.keys(tables).map(key => [key, new Map(induced.slice(1).filter(row => row[5] === key && row[3] !== 'equivalent').map(row => [row[0], row]))]))
    for (const [char, , written, basis, from, key, ids, lent] of induced.slice(1)) {
      // A row written from a description names the dataset the description comes from.
      expect(ids).toMatch(basis === 'ids' ? /^(babelstone-ids|yi-bai-ids)( (babelstone-ids|yi-bai-ids))?$/ : /^$/)
      // An induced row never stands in for a character its source records.
      expect(tables[key].has(char)).toBe(false)
      expect(['equivalent', 'ids', 'borrowed', 'within']).toContain(basis)
      // The sources a row borrows from are other than its own.
      expect(lent).toMatch(/^$|^(cns11643|rime-stroke|kanjivg|entered)( (cns11643|rime-stroke|kanjivg|entered))*$/)
      expect(lent.split(' ')).not.toContain(key)
      if (basis === 'equivalent') {
        expect(char.normalize('NFKC')).toBe(from)
        // The unified ideograph's recorded orders, or the row it is given here where the source has none.
        const given = givenIn[key].get(from)
        expect(written.split(' ')).toEqual(own[key].get(from) ?? given?.[2].split(' '))
        expect(lent).toBe(own[key].has(from) ? '' : given?.[7])
      } else if (basis === 'within') {
        // A form read inside characters is read under the component it is drawn as.
        expect(shapes.get(char)?.name).toBe(from)
        expect(written).toMatch(key === 'rime-stroke' ? /^[hspnz]+$/ : /^[1-5]+$/)
        expect(own[key].has(char)).toBe(false)
      } else if (basis === 'borrowed') {
        // A borrowed row repeats what its lender has, in the borrower's symbols.
        // What it repeats is the lender's record, or an order entered for the lender, which `lent` says.
        expect(lent).toBe(tables[from].has(char) ? from : 'entered')
        expect(written.split(' ')).toEqual([...new Set(own[from].get(char).map(code => inSymbols(code, key)))])
        expect(own[key].has(char)).toBe(false)
      } else {
        expect(/[⿰-⿿]/u.test(from)).toBe(true)
        expect(from.startsWith('〾')).toBe(false)
        expect(written.split(' ').length).toBeLessThanOrEqual(manifest.induction.ways)
      }
    }
    // A numbered component is read by its fragment, and the row keeps BabelStone's spelling.
    expect(induced.some(row => row[3] === 'ids' && /\{\d+\}/.test(row[4]))).toBe(true)
    const row = induced.find(row => row[0] === '⼀' && row[5] === 'cns11643')
    expect(row?.slice(2)).toEqual(['1', 'equivalent', '一', 'cns11643', '', ''])
    expect(induced.some(row => row[6] === 'yi-bai-ids')).toBe(true)
    // A BabelStone description whose component is read by one of Yi Bai's names both: 𫥎 is ⿱免⺀, and ⺀ is Yi Bai's ⿱丶丶.
    expect(induced.find(row => row[0] === '𫥎' && row[5] === 'cns11643')?.[6]).toBe('babelstone-ids yi-bai-ids')
    // A row under ⿹ or ⿻ is written only through an enclosure with a learned place.
    for (const { source, rules } of manifest.induction.learned) {
      const taught = new Set(rules.map(rule => rule.operator + rule.enclosure))
      const crossing = induced.filter(row => row[5] === source && row[3] === 'ids' && /^[⿹⿻]/u.test(row[4]))
      expect(crossing.every(row => taught.has([...row[4]].slice(0, 2).join('')))).toBe(true)
    }
    // The entered ㇒ lets the characters it is a component of be written.
    expect(induced.some(row => row[5] === 'cns11643' && row[4].includes('㇒'))).toBe(true)
    expect(manifest.texts).toContain('LICENSE-yi-bai-ids-MIT.txt')
  })

  it('counts its coverage and scores its rules on the recorded characters', () => {
    for (const row of manifest.coverage) {
      const rows = induced.slice(1).filter(entry => entry[5] === row.source)
      expect(rows.filter(entry => entry[3] === 'equivalent').length).toBe(row.equivalent)
      expect(rows.filter(entry => entry[3] === 'ids').length).toBe(row.ids)
      expect(rows.filter(entry => entry[3] === 'borrowed').length).toBe(row.borrowed)
      expect(rows.filter(entry => entry[3] === 'within').length).toBe(row.within)
      expect(readme).toContain(row.recorded.toLocaleString('en'))
    }
    expect(manifest.coverage.find(row => row.source === 'rime-stroke').recorded).toBe(rime.length - 1)
    expect(manifest.coverage.find(row => row.source === 'cns11643').recorded).toBe(cns.length - 1)
    expect(manifest.coverage.find(row => row.source === 'kanjivg').recorded).toBe(kanjivg.length - 1)
    for (const { source, operators } of manifest.induction.validation) {
      const taught = new Set(manifest.induction.learned.find(entry => entry.source === source).rules.map(rule => rule.operator))
      for (const row of operators) {
        expect(row.agree).toBeLessThanOrEqual(row.written)
        expect(row.written).toBeLessThanOrEqual(row.described)
        expect(row.induced).toBe(manifest.induction.operators.includes(row.operator) ? 'always' : taught.has(row.operator) ? 'learned' : 'never')
        if (row.induced === 'never') expect(row.written).toBe(0)
      }
      // Scored on characters the places were not learned from, the rules agree with the source on most of what they write.
      expect(operators.reduce((sum, row) => sum + row.agree, 0) / operators.reduce((sum, row) => sum + row.written, 0)).toBeGreaterThan(0.85)
    }
  })

  it('writes a radical form as most of the characters with its component do, and says what that rests on', () => {
    const within = (char, key) => induced.find(row => row[0] === char && row[5] === key && row[3] === 'within')
    const rests = (char, key) => evidence.find(row => row[0] === char && row[2] === key)
    const tables = { 'rime-stroke': orders(rime), cns11643: orders(cns), kanjivg: orders(kanjivg) }
    // All 33 CNS characters with 旡 leave 1535 for it.
    expect(within('⺛', 'cns11643')?.slice(2)).toEqual(['1535', 'within', '旡', 'cns11643', '', ''])
    expect(rests('⺛', 'cns11643')?.slice(3, 7)).toEqual(['旡', 'same', '33', '1535×33'])
    // ⺫ is paired with 目 by Unicode and drawn as 罒: it is read under 罒.
    expect(twins.get('⺫')).toBe('目')
    expect(within('⺫', 'cns11643')?.slice(2, 5)).toEqual([tables.cns11643.get('罒')[0], 'within', '罒'])
    // ⻋ is read in two orders and takes the commoner; ⻤ is only drawn close to 鬼, which its evidence says.
    expect(within('⻋', 'cns11643')?.[2]).toBe('1521')
    expect(rests('⻋', 'cns11643')?.[6]).toBe('1521×73 1512×11')
    expect(rests('⻤', 'cns11643')?.[4]).toBe('variant')
    // Every row read inside characters has its evidence, in its own symbols, the order taken first.
    const rows = induced.slice(1).filter(row => row[3] === 'within')
    expect(evidence.length - 1).toBe(rows.length)
    for (const [char, , written, , from, key, , lent] of rows) {
      const [, , , named, shape, found, read, chars, lender] = rests(char, key)
      const ways = read.split(' ').map(way => way.split('×'))
      expect([named, lender, ways[0][0]]).toEqual([from, lent, written])
      expect(shape).toBe(shapes.get(char).shape)
      expect(ways.length).toBeLessThanOrEqual(3)
      for (const [order, count] of ways) {
        expect(order).toMatch(key === 'rime-stroke' ? /^[hspnz]+$/ : /^[1-5]+$/)
        expect(Number(count)).toBeGreaterThan(0)
        expect(Number(count)).toBeLessThanOrEqual(Number(found))
      }
      expect(ways.every((way, index) => !index || Number(ways[index - 1][1]) >= Number(way[1]))).toBe(true)
      // The characters read are records of the source they are read from.
      expect([...chars].every(example => tables[lender || key].has(example))).toBe(true)
    }
    // Nothing wanted is also written.
    for (const [char, , key] of wanted.slice(1)) expect(induced.some(row => row[0] === char && row[5] === key)).toBe(false)
  })

  it('writes a character from its own parts where only one of them is borrowed', () => {
    // CNS has no 冫 and no order for its ㇀, so 冫 is borrowed; 鿑 is then 冫 and CNS's own 玉.
    const row = (char, key) => induced.find(entry => entry[0] === char && entry[5] === key)
    expect(row('冫', 'cns11643')?.slice(3, 5)).toEqual(['borrowed', 'rime-stroke'])
    expect(row('鿑', 'cns11643')?.slice(3, 8)).toEqual(['ids', '⿰冫玉', 'cns11643', 'babelstone-ids', 'rime-stroke'])
    // No character is borrowed whole whose one description is two parts side by side or stacked, both written for the source.
    const one = new Map(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString().split('\n')
      .filter(line => line && !line.startsWith('#')).map(line => line.split('\t')).filter(row => row[1] && !row[1].includes(' ')).map(row => [row[0], [...row[1].replace(/\([A-Z]+\)$/, '')]]))
    for (const key of ['cns11643', 'rime-stroke', 'kanjivg']) {
      const has = new Set([...orders(key === 'cns11643' ? cns : key === 'kanjivg' ? kanjivg : rime).keys(), ...induced.filter(entry => entry[5] === key).map(entry => entry[0]), ...entered.filter(entry => entry[5] === key).map(entry => entry[0])])
      const whole = induced.filter(entry => entry[5] === key && entry[3] === 'borrowed').map(entry => entry[0])
        .filter(char => { const parts = one.get(char); return parts?.length === 3 && '⿰⿱'.includes(parts[0]) && parts[1] !== parts[2] && has.has(parts[1]) && has.has(parts[2]) })
      expect(whole).toEqual([])
    }
  })

  it('keeps entered orders apart and says what is still wanted', () => {
    const tables = { 'rime-stroke': orders(rime), cns11643: orders(cns), kanjivg: orders(kanjivg) }
    const symbols = { cns11643: /^[1-5]+( [1-5]+)*$/, 'rime-stroke': /^[hspnz]+( [hspnz]+)*$/, kanjivg: /^[1-5]+( [1-5]+)*$/ }
    for (const [char, , written, basis, by, source, date] of entered.slice(1)) {
      expect(written).toMatch(symbols[source])
      expect(basis).not.toMatch(/[\t\n\r]/)
      expect(by).toBeTruthy()
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // An entered order is never a second opinion on a recorded one.
      expect(tables[source].has(char)).toBe(false)
    }
    for (const row of manifest.coverage) {
      expect(row.entered).toBe(entered.slice(1).filter(entry => entry[5] === row.source).length)
      expect(Object.values(row.reasons).reduce((sum, count) => sum + count, 0)).toBe(row.none)
      const rows = wanted.slice(1).filter(entry => entry[2] === row.source)
      // Nothing wanted has an order in any source, and the list is ranked.
      expect(rows.every(entry => Object.values(tables).every(table => !table.has(entry[0])) && Number(entry[4]) <= Number(entry[3]))).toBe(true)
      // A character left without an order is wanted itself.
      expect(rows.length).toBeGreaterThanOrEqual(row.none)
    }
    expect(readme).toContain('data/stroke-orders-entered.tsv')
  })

  it('learns where each enclosure is written from enough characters', () => {
    for (const { rules } of manifest.induction.learned) {
      expect(rules.length).toBeGreaterThan(5)
      for (const rule of rules) {
        expect(manifest.induction.places).toContain(rule.place)
        expect(rule.support).toBeGreaterThanOrEqual(manifest.induction.support)
        expect(rule.agree / rule.support).toBeGreaterThanOrEqual(manifest.induction.agreement)
      }
    }
    const cns = manifest.induction.learned.find(entry => entry.source === 'cns11643').rules
    // 廴 is written after what it carries, 气 before what it holds.
    expect(cns.find(rule => rule.operator === '⿺' && rule.enclosure === '廴')?.place).toBe('inner-first')
    expect(cns.find(rule => rule.operator === '⿹' && rule.enclosure === '气')?.place).toBe('outer-first')
  })
})
