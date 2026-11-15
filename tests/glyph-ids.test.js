// data/glyph-ids.tsv: one well-formed row per han-input glyph.
import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const VERDICTS = new Set(['known', 'model', 'written', 'wrong', 'unclear'])
const rows = readFileSync(new URL('../data/glyph-ids.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter(line => line && !line.startsWith('#'))
  .map(line => line.split('\t'))

it('keeps one row per han-input record', () => {
  const keys = rows.map(row => row[0])
  expect(new Set(keys).size).toBe(keys.length)
  for (const key of keys) expect(key).toMatch(/^[a-z0-9_]+:[^\s:]+$/u)
})

it('gives a description exactly where the verdict names one', () => {
  for (const [key, ids, verdict, by] of rows) {
    expect(VERDICTS.has(verdict), key).toBe(true)
    expect(Boolean(ids), key).toBe(!['wrong', 'unclear'].includes(verdict))
    if (verdict === 'known') expect(by, key).toMatch(/^(zi\.tools|babelstone) \S+$/u)
  }
})
