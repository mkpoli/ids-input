import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { EXAMPLES, EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { parseIdsTable } from '../src/adapter/babelstone.js'
import { size } from '../src/composer/loader.js'
import { LONGEST, parse, leaves } from '../src/core/index.js'

const table = parseIdsTable(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString('utf8'))
/** The characters BabelStone describes with each sequence. */
const described = new Map()
for (const [char, sequences] of table) for (const { text } of sequences) {
  const chars = described.get(text)
  if (chars) { if (!chars.includes(char)) chars.push(char) } else described.set(text, [char])
}

describe('the demo examples', () => {
  it('read as whole descriptions', () => {
    for (const { sequence } of EXAMPLES) {
      expect(parse(sequence).problem).toBeUndefined()
      expect([...sequence].length).toBeLessThanOrEqual(LONGEST)
    }
  })
  it('name a character BabelStone gives for the sequence, and none when they name none', () => {
    for (const { sequence, char } of EXAMPLES) {
      const found = described.get(sequence) ?? []
      if (char) {
        expect([...char]).toHaveLength(1)
        expect(found).toContain(char)
      } else {
        expect(found).toEqual([])
      }
    }
  })
  it('are distinct', () => {
    expect(new Set(EXAMPLES.map(example => example.sequence)).size).toBe(EXAMPLES.length)
  })
})

it('keeps Tangut in its own examples section', () => {
  expect(EXAMPLE_GROUPS.map(group => group.key)).toEqual(['han', 'tangut', 'hybrid', 'samples', 'unencoded'])
  const tangut = EXAMPLE_GROUPS.find(group => group.key === 'tangut').examples
  expect(tangut.every(example => /^[\u{17000}-\u{187FF}\u{18D00}-\u{18D7F}]$/u.test(example.char))).toBe(true)
  const trees = tangut.map(example => parse(example.sequence).tree)
  expect(trees.filter(tree => size(tree).depth >= 4).length).toBeGreaterThanOrEqual(3)
  expect(trees.filter(tree => leaves(tree).length >= 6).length).toBeGreaterThanOrEqual(3)
  for (const operator of ['⿲', '⿳', '⿸', '⿵', '⿺']) expect(tangut.some(example => example.sequence.includes(operator))).toBe(true)
  expect(EXAMPLE_GROUPS[0].examples.every(example => !/[\u{17000}-\u{18DFF}]/u.test(example.char))).toBe(true)
})
