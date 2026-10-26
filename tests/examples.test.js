import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { EXAMPLES, EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { parseIdsTable } from '../src/adapter/babelstone.js'
import { LONGEST, parse } from '../src/core/index.js'

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
  expect(EXAMPLE_GROUPS[1].examples.map(example => example.char)).toEqual(['𗀀', '𘴅'])
  expect(EXAMPLE_GROUPS[0].examples.every(example => !/[\u{17000}-\u{18DFF}]/u.test(example.char))).toBe(true)
})
