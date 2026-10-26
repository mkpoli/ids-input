import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { subtrees, frequencies, strokeCounter, MANUAL_PARTS } from '../scripts/build_subtree_parts.mjs'
import { parseIdsTable } from '../src/adapter/babelstone.js'
import { parse, write, replaceAt } from '../src/core/ids.js'

it('counts nested nodes, repeated leaves and regional alternatives separately', () => {
  const table = parseIdsTable('甲\t⿰木⿱木木(G) ⿰木⿱木木(T)\n乙\t⿱木木(G)')
  const entries = new Map(frequencies(table).map(entry => [entry.text, entry]))
  expect(entries.get('木')).toMatchObject({ uses: 2, occurrences: 5, nestedUses: 2 })
  expect(entries.get('⿱木木')).toMatchObject({ uses: 2, occurrences: 2, nestedUses: 1 })
  expect(entries.get('⿰木⿱木木').nestedUses).toBe(0)
})

it('preserves numbered unknowns, selectors and unary/ternary operators', () => {
  expect(subtrees('⿲{12}木󠄀⿾水').map(node => node.text)).toEqual(['{12}', '木󠄀', '水', '⿾水', '⿲{12}木󠄀⿾水'])
  const rejected = []
  expect(frequencies(parseIdsTable('甲\t⿲木木\n乙\t⿰木水'), rejected)).toHaveLength(3)
  expect(rejected).toEqual([{ char: '甲', text: '⿲木木' }])
})

it('derives stroke estimates while retaining unknown and cyclic counts', () => {
  const count = strokeCounter(parseIdsTable('甲\t⿰乙木\n乙\t⿱甲木'), [['木', 1, 4], ['水', 1, 4]])
  const strokes = text => count(subtrees(text).at(-1))
  expect(strokes('⿰木⿱木水')).toBe(12)
  expect(strokes('⿻木水')).toBe(8)
  expect(strokes('㇯木水')).toBeNull()
  expect(strokes('甲')).toBeNull()
  expect(strokes('⿰木{12}')).toBeNull()
})

it('ships all frequencies and selectable common compound parts with strokes', () => {
  const report = JSON.parse(gunzipSync(readFileSync(new URL('../data/ids-subtrees.json.gz', import.meta.url))))
  const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
  expect(report.characters).toBe(103825)
  expect(report.parts.length).toBeGreaterThan(100000)
  const compounds = palette.parts.filter(row => [...row[0]].length > 1)
  expect(compounds).toHaveLength(8)
  expect(compounds.find(row => row[0] === '⿰冫⿱丿丶')).toEqual(['⿰冫⿱丿丶', 0, 4, 1, null, 'c'])
  for (const [text, uses, strokes, derived, , kind] of compounds) {
    expect(parse(text).problem).toBeUndefined()
    if (MANUAL_PARTS.includes(text)) expect(uses).toBe(0)
    else expect(uses).toBeGreaterThanOrEqual(50)
    expect(strokes).toBeGreaterThan(0)
    expect(derived).toBe(1)
    expect(kind).toBe('c')
    const tree = parse(text).tree
    expect(write(replaceAt(parse('⿰木水').tree, [1], tree))).toBe(`⿰木${text}`)
    expect(report.parts.find(row => row[0] === text)?.[1] ?? 0).toBe(uses)
  }
})
