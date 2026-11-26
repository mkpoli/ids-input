import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createParser, textOf } from '../demo/lib/baishi-parser.js'
import { places, readChain, readEntry, readIndex, readOverlap, readPrefix, readRow, readVariant, variantIds } from '../demo/lib/baishi-reading.js'
import { indexRows, REVISION, rowSource } from '../demo/lib/zi-tools-rows.js'
import { MALFORMED, PREFIX_COMPARISONS, splitTag } from '../demo/lib/baishi.js'

// The parser on the zi.tools IDS Extension appendix reads the grammar file itself, and the rows it
// looks up are a pinned copy of yi-bai/ids.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url))
const grammar = read('data/baishi-ids.ebnf').toString('utf8')
const parser = createParser(grammar)
const table = gunzipSync(read('data/zi-tools-rows.tsv.gz')).toString('utf8')
const [header, ...lines] = table.split('\n')
const HASHES = {
  0: 'af5a0de3aae85ee1a69001918a78d4060d9a334c508ad2c6ac5854786791d474',
  1: 'aa9ba7e394d8fd5cf797b6b9bd6ae5b4546f5222d10f15158c656f099b35c0cf',
  2: 'b728e92679a9cb18a8f67f55f654f03875791dc34f6bab41ed1d4b4116bea7d6',
}

/** The three files of yi-bai/ids, rebuilt from the table. */
function rebuild() {
  /** @type {string[][]} */
  const levels = [[], [], []]
  for (const line of lines) {
    const level = Number(line[0]), row = line.slice(2)
    if (level === 0) { levels[0].push(row); levels[1].push(row); levels[2].push(row) }
    // A level-1 line stands for level 2 too, unless a level-2 line follows.
    if (level === 1) levels[1][levels[1].length - 1] = row
    if (level >= 1) levels[2][levels[2].length - 1] = row
  }
  return levels.map(rows => rows.join('\n'))
}

describe('the pinned rows of yi-bai/ids', () => {
  it('rebuild ids_lv0.txt, ids_lv1.txt and ids_lv2.txt byte for byte', () => {
    expect(header).toContain(REVISION)
    for (const [level, hash] of Object.entries(HASHES)) expect(header).toContain(`ids_lv${level}.txt ${hash}`)
    rebuild().forEach((text, level) => {
      expect(createHash('sha256').update(text).digest('hex')).toBe(HASHES[/** @type {0 | 1 | 2} */ (level)])
    })
  })
  it('compares distinct code points at their cited lv0 rows and aligns matching IDS bodies', () => {
    const rows = indexRows(table)
    for (const { columns: [left, right] } of PREFIX_COMPARISONS) {
      expect(left.char).not.toBe(right.char)
      for (const column of [left, right]) {
        const record = rows.get(column.char)[0]
        expect([record.level, record.line]).toEqual([0, column.line])
        const descriptions = record.text.split('\t').slice(1).flatMap(group => group.split(';'))
        for (const { text } of column.entries) expect(descriptions).toContain(text)
      }
      const prefixed = left.entries.filter(entry => entry.text.startsWith('{'))
      for (const [index, entry] of prefixed.entries()) {
        expect(splitTag(entry.text).body.replace(/^\{[^}]+\}/u, '')).toBe(splitTag(right.entries[index].text).body)
      }
    }
  })
  it('are found by character, with the line of each level that differs', () => {
    const rows = indexRows(table)
    expect(rows.size).toBe(102034)
    expect(rows.get('甲')).toEqual([{ level: 0, line: 10035, text: '甲\t⿻[1:]丨日' }])
    expect(rows.get('囚')?.map(row => [row.level, row.line, row.text])).toEqual([
      [0, 2267, '囚\t⿴囗.人d(.);⿴囗.人.(J)'], [1, 2267, '囚\t⿴囗人(.,J)']])
    expect(rowSource({ level: 1, line: 2267, text: '' })).toBe(`https://github.com/yi-bai/ids/blob/${REVISION}/ids_lv1.txt#L2267`)
  })
})

describe('the grammar-driven parser', () => {
  it('reads the grammar file the page publishes, special sequences included', () => {
    expect([...parser.rules.keys()]).toContain('row')
    expect(() => createParser(grammar.replaceAll('? TAB ?', '? Tabulator ?'))).toThrow(/Tabulator/)
    // The memo reads each rule once from each place, which a left-recursive rule would need more of.
    expect(() => createParser('a = a, "x" | "y" ;')).toThrow(/left-recursive/)
    expect(() => createParser('s = b, "x" ; b = [s] ;')).toThrow(/left-recursive/)
    expect(createParser('s = "(", [s], ")" ;').accepts('s', '(())')).toBe(true)
  })
  it('accepts every row of the three levels except the four malformed ones, and covers each whole', () => {
    const files = rebuild().map(text => text.split('\n'))
    const failed = []
    files.forEach((rows, level) => rows.forEach((row, i) => {
      if (!row || (level > 0 && row === files[level - 1][i])) return
      const got = parser.parse('row', row)
      if (!got.ok) { failed.push([`lv${level}`, i + 1, row]); return }
      // Every code point belongs to exactly one terminal, in order: the tree is the text.
      const terminals = []
      const walk = node => { if (node.rule === null) terminals.push(textOf(node, got.chars)); node.children.forEach(walk) }
      walk(got.tree)
      expect(terminals.join('')).toBe(row)
    }))
    expect(failed).toEqual(MALFORMED.map(([level, line, row]) => [level, line, row]))
  }, 600000)
  it('says where a text fails and what the grammar expected there', () => {
    expect(parser.parse('primary group', '⿰日')).toMatchObject({ ok: false, at: 2, expected: ['variant id', 'component'] })
    expect(parser.parse('row', '晋\t⿱亚日(q3883,)')).toMatchObject({ ok: false, at: 12, expected: ['variant id'] })
    expect(parser.parse('row', '洅\t⿰氵.再(.);⿰氵.⿱[:-1]一.冉K(J)')).toMatchObject({ ok: false, at: 14, expected: ['component'] })
    expect(parser.parse('primary group', '⿰日月;')).toMatchObject({ ok: false, at: 4, expected: ['entry'] })
    expect(parser.parse('primary group', '⿰日月)')).toMatchObject({ ok: false, at: 3, expected: ['variant id', '"("', '";"', 'end'] })
    expect(parser.parse('primary group', '#(H')).toMatchObject({ ok: false, at: 3 })
  })
})

/** @param {string} text */
const entryOf = text => {
  const got = parser.parse('entry', text)
  if (!got.ok) throw new Error(text)
  return { entry: readEntry(got.tree, got.chars), chars: got.chars }
}

describe('reading a parse', () => {
  it('splits a row into its groups and descriptions, back to the same text', () => {
    const text = '令\t⿱亽龴.(.);⿱亼.龴.(H);⿱人.𪜁(J);⿳人d丶.龴.(d..);⿱亼d龴.(dh.);⿱人d𪜁(dhs);⿱亽卩(hdx);⿱亼.卩(hsx)\t⿱亼.𰆊(J);⿱亼d𰆊(dhs)'
    const got = parser.parse('row', text)
    if (!got.ok) throw new Error('令')
    const row = readRow(got.tree, got.chars)
    expect(row.headword).toBe('令')
    expect(row.groups.map(group => group.alternative)).toEqual([false, true])
    expect(`${row.headword}\t${row.groups.map(group => group.entries.map(entry => entry.text).join(';')).join('\t')}`).toBe(text)
  })
  it('gives each token the workshop path of its place, in reading order', () => {
    const { entry } = entryOf('{曰}⿴囗.一.')
    expect(entry.tokens.map(token => [token.kind, token.text, token.path.join('.')])).toEqual([
      ['prefix', '{曰}', ''], ['operator', '⿴', ''], ['char', '囗', '0'], ['variant', '.', '0'], ['char', '一', '1'], ['variant', '.', '1']])
    expect(places(entry.tokens).map(place => [place.text, place.path.join('.'), place.members])).toEqual([['⿴', '', [1]], ['囗', '0', [2, 3]], ['一', '1', [4, 5]]])
    const nested = entryOf('⿻[1:]亅⿱⿻𠃊.一.八d').entry
    expect(nested.tokens.map(token => [token.text, token.path.join('.')])).toEqual([
      ['⿻', ''], ['[1:]', ''], ['亅', '0'], ['⿱', '1'], ['⿻', '1.0'], ['𠃊', '1.0.0'], ['.', '1.0.0'], ['一', '1.0.1'], ['.', '1.0.1'], ['八', '1.1'], ['d', '1.1']])
    expect(nested.leaves.map(leaf => leaf.path.join('.'))).toEqual(['0', '1.0.0', '1.0.1', '1.1'])
  })
  it('reads a stroke chain stroke by stroke', () => {
    const { entry, chars } = entryOf('#(-𠃌𠃊x0)')
    const chain = readChain(entry.leaves[0].part, chars)
    expect(chain.parts.map(part => [part.reversed, part.stroke, part.crosses, part.broken])).toEqual([[true, '𠃌', null, false], [false, '𠃊', 0, false]])
    const yi = entryOf('#(HPHwg)')
    const letters = readChain(yi.entry.leaves[0].part, yi.chars)
    expect(letters.parts.map(part => part.stroke)).toEqual(['H', 'PHwg'])
    expect(letters.parts[1].letter).toMatchObject({ base: 'P', rounded: true, hook: true, stroke: '丿' })
    const broken = entryOf('#(一-𠃍丨b一-𠃍)')
    expect(readChain(broken.entry.leaves[0].part, broken.chars).parts.map(part => part.broken)).toEqual([false, false, true, false, false])
  })
  it('reads overlap and index brackets', () => {
    const slice = entryOf('⿻[1:]丨日')
    expect(readOverlap(/** @type {any} */ (slice.entry.shape).modifier, slice.chars)).toEqual([{ kind: 'slice', top: '1', bottom: null }])
    const matrix = entryOf('⿻[l,l,.]勹巳.')
    expect(readOverlap(/** @type {any} */ (matrix.entry.shape).modifier, matrix.chars)).toEqual([{ kind: 'matrix', rows: [['l'], ['l'], ['.']] }])
    const index = entryOf('⿴[1]日一')
    expect(readIndex(/** @type {any} */ (index.entry.shape).modifier, index.chars)).toBe(1)
  })
  it('tells variant identifiers apart by the first pattern they match', () => {
    expect(readVariant('.')).toMatchObject({ kind: 'wildcard' })
    expect(readVariant('T')).toMatchObject({ kind: 'source', source: 'T' })
    expect(readVariant('q454a17')).toMatchObject({ kind: 'ucv', lead: 'q', rule: '454a', glyph: '17', suffix: '' })
    expect(readVariant('qq123')).toMatchObject({ kind: 'imaginary', rules: ['123'] })
    expect(readVariant('qy')).toMatchObject({ kind: 'otherQ' })
    expect(readVariant('dh.')).toMatchObject({ kind: 'style', letters: ['d', 'h', '.'] })
    const tags = entryOf('⿴囗人(.,J)')
    expect(variantIds(/** @type {any} */ (tags.entry.tags), tags.chars)).toEqual(['.', 'J'])
  })
  it('reads a uniqueness prefix', () => {
    const { entry, chars } = entryOf('{?0丗}⿻⿺𠃊.〢一.')
    expect(readPrefix(/** @type {any} */ (entry.prefix), chars)).toEqual({ char: '丗', far: true, digit: '0', source: '' })
  })
})
