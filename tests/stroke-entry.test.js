import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { entryLine, entryProblem, parseEntries, withEntry, withoutEntry } from '../src/core/stroke-entry.js'

const file = readFileSync(new URL('../data/stroke-orders-entered.tsv', import.meta.url), 'utf8')
const row = { char: '𰀁', source: 'cns11643', orders: '12 21', basis: 'p. 12', by: 'someone', date: '2026-11-15' }

it('reads the committed file', () => {
  const entries = parseEntries(file)
  expect(entries.find(entry => entry.char === '㇒')).toMatchObject({ source: 'cns11643', orders: '3' })
})

it('names the field a row is refused for', () => {
  expect(entryProblem(row)).toBe(null)
  expect(entryProblem({ ...row, char: '王玉' })).toBe('char')
  expect(entryProblem({ ...row, char: '#' })).toBe('char')
  expect(entryProblem({ ...row, source: 'wubi' })).toBe('source')
  expect(entryProblem({ ...row, orders: 'hs' })).toBe('orders')
  expect(entryProblem({ ...row, source: 'rime-stroke', orders: 'hs zp' })).toBe(null)
  expect(entryProblem({ ...row, orders: '12  21' })).toBe('orders')
  expect(entryProblem({ ...row, basis: ' ' })).toBe('basis')
  expect(entryProblem({ ...row, basis: 'a\tb' })).toBe('basis')
  expect(entryProblem({ ...row, by: '' })).toBe('by')
  expect(entryProblem({ ...row, date: '15 Nov' })).toBe('date')
})

it('writes a row into the file and takes it out again', () => {
  const added = withEntry(file, row)
  expect(added.endsWith(`${entryLine(row)}\n`)).toBe(true)
  expect(added.startsWith(file.replace(/\n$/, ''))).toBe(true)
  // The same character and source replaces its row in place; another source is another row.
  const changed = withEntry(added, { ...row, orders: '21' })
  expect(parseEntries(changed).filter(entry => entry.char === row.char)).toEqual([{ ...row, orders: '21' }])
  expect(parseEntries(withEntry(changed, { ...row, source: 'kanjivg' })).filter(entry => entry.char === row.char)).toHaveLength(2)
  expect(withoutEntry(added, row.char, row.source)).toBe(file)
  expect(() => parseEntries(`${added}${entryLine(row)}\n`)).toThrow(/entered twice/)
})
