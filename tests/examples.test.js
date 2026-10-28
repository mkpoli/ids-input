import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { EXAMPLES, EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { expandNumberedComponents, parseIdsTable, readNumberedComponents } from '../src/adapter/babelstone.js'
import { onlyTangut } from '../src/composer/tangut.js'
import { size } from '../src/composer/loader.js'
import { LONGEST, OPERATORS, parse, leaves } from '../src/core/index.js'

const shipped = parseIdsTable(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString('utf8'))
const components = readNumberedComponents(readFileSync(new URL('../data/ids-components.tsv', import.meta.url), 'utf8'))
const table = expandNumberedComponents(shipped, components)
/** The characters BabelStone describes with each sequence. */
const described = new Map()
for (const [char, sequences] of table) for (const { text } of sequences) {
  const chars = described.get(text)
  if (chars) { if (!chars.includes(char)) chars.push(char) } else described.set(text, [char])
}

describe('the demo examples', () => {
  it('read as whole descriptions', () => {
    for (const { sequence, char } of EXAMPLES) {
      expect([...sequence].length).toBeLessThanOrEqual(LONGEST)
      if ([...sequence].length === 1) {
        expect(parse(sequence, { open: true }).tree).toBe(sequence)
        expect(char).toBe(sequence)
        continue
      }
      expect(parse(sequence).problem).toBeUndefined()
    }
  })
  it('name a character from BabelStone or a cited alternative description', () => {
    for (const group of EXAMPLE_GROUPS) {
      for (const example of group.examples) {
        const { sequence, char } = example
        const found = described.get(sequence) ?? []
        if (group.source) {
          expect(group.source).toMatch(/^https:\/\//)
          const name = char || example.abbreviates
          expect(typeof name).toBe('string')
          expect([...name]).toHaveLength(1)
          if (example.abbreviates) expect([...example.abbreviates]).toHaveLength(1)
        } else if (char) {
          expect([...char]).toHaveLength(1)
          if ('source' in example && example.source === 'data/small-seal.json.gz') {
            const seal = JSON.parse(gunzipSync(readFileSync(new URL('../data/small-seal.json.gz', import.meta.url))))
            expect(seal.table[char]).toContain(sequence)
            expect(seal.modern[char]).toContain(example.modern)
          } else if ('source' in example) {
            expect(example).toEqual({ sequence: '⿰𛂦方', char: '𭤪', source: 'https://www.unicode.org/irg/docs/n2744-IRGN2741Response.pdf#page=7' })
            expect(table.get(char).map(entry => entry.text)).toContain('⿰？方')
          } else expect(found).toContain(char)
        } else {
          expect(found).toEqual([])
        }
      }
    }
  })
  it('keep the Geba abbreviations in one cited group', () => {
    const group = EXAMPLE_GROUPS.find(group => group.key === 'geba')
    expect(group.source).toBe('https://zh.wikipedia.org/wiki/全学联汉字')
    expect(group.examples).toContainEqual({ sequence: '⿱宀R', char: '', abbreviates: '寮' })
    expect(group.examples).toContainEqual({ sequence: '⿰言ギ', char: '', abbreviates: '議' })
    expect(group.examples).toContainEqual({ sequence: '权', char: '权', abbreviates: '権' })
    expect(group.examples).toContainEqual({ sequence: '战', char: '战', abbreviates: '戦' })
    expect(group.examples.every(example => example.abbreviates && (example.char === '' || example.char === example.sequence))).toBe(true)
    expect(group.examples).toHaveLength(28)
  })
  it("writes out 龍's numbered right part", () => {
    expect(table.get('龍').map(entry => entry.text)).toContain('⿰𦚏⿷己三')
    expect(described.get('⿰𦚏⿷己三')).toContain('龍')
  })
  it('are distinct', () => {
    expect(new Set(EXAMPLES.map(example => example.sequence)).size).toBe(EXAMPLES.length)
  })
})

it('keeps all Tangut examples in a separate section', () => {
  expect(EXAMPLE_GROUPS.map(group => group.key)).toEqual(['basic', 'complex', 'repeated', 'enclosures', 'mixed', 'geba', 'seal', 'tangut'])
  const tangut = EXAMPLE_GROUPS.find(group => group.key === 'tangut').examples
  expect(tangut.every(example => onlyTangut(example.sequence))).toBe(true)
  expect(EXAMPLE_GROUPS.filter(group => group.key !== 'tangut').flatMap(group => group.examples).some(example => onlyTangut(example.sequence))).toBe(false)
  expect(tangut).toHaveLength(12)
  expect(tangut.every(example => /^[\u{17000}-\u{187FF}\u{18D00}-\u{18D7F}]$/u.test(example.char))).toBe(true)
  const trees = tangut.map(example => parse(example.sequence).tree)
  expect(trees.filter(tree => size(tree).depth >= 4).length).toBeGreaterThanOrEqual(3)
  expect(trees.filter(tree => leaves(tree).length >= 6).length).toBeGreaterThanOrEqual(3)
  for (const operator of ['⿲', '⿳', '⿸', '⿵', '⿺']) expect(tangut.some(example => example.sequence.includes(operator))).toBe(true)
})

it('preserves digits, hentaigana, Latin and nested Bopomofo in the examples', () => {
  for (const sequence of ['⿱⿰◇ㅏㄴ', '⿰扌3', '⿰𛂦方', '⿰亻A', '⿰木⿳ㄙㄨㄥ', '⿰木⿱ㄅㄞ', '⿰木き']) {
    expect(EXAMPLES.some(example => example.sequence === sequence)).toBe(true)
    expect(parse(sequence).problem).toBeUndefined()
  }
  expect(leaves(parse('⿰木⿳ㄙㄨㄥ').tree).map(leaf => leaf.char)).toEqual(['木', 'ㄙ', 'ㄨ', 'ㄥ'])
})


it('illustrates every IDC outside the separate Tangut section', () => {
  const sequences = EXAMPLE_GROUPS.filter(group => group.key !== 'tangut').flatMap(group => group.examples.map(example => example.sequence))
  for (const [operator] of OPERATORS) {
    expect(sequences.some(sequence => sequence.includes(operator))).toBe(true)
  }
})
