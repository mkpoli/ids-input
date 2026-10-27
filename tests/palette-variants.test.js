import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { adjacentVariants } from '../src/core/palette.js'
import { babelStoneAdapter, paletteRows } from '../src/adapter/babelstone.js'

const part = (text, group, strokes = 4) => ({ part: text, kind: 'c', strokes, ...(group ? { variantGroup: group } : {}) })
it('keeps families at their first frequency position without changing literal forms', () => {
  const rows = [part('木'), part('釒', '金'), part('水'), part('钅', '金'), part('金', '金'), part('氵', '水'), part('火')]
  rows[2].variantGroup = '水'
  const ordered = adjacentVariants(rows)
  expect(ordered.map(row => row.part)).toEqual(['木', '釒', '钅', '金', '水', '氵', '火'])
  expect(ordered[1]).toBe(rows[1])
  expect(rows.map(row => row.part)).toEqual(['木', '釒', '水', '钅', '金', '氵', '火'])
  expect(adjacentVariants(ordered)).toEqual(ordered)
  expect(adjacentVariants(rows.filter(row => ['金', '木'].includes(row.part))).map(row => row.part)).toEqual(['木', '金'])
})

it('groups shipped traditional, simplified and positional forms using the supplied table', async () => {
  const palette = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))))
  const formsText = readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8')
  const rows = await babelStoneAdapter({ palette, formsText }).parts()
  const ordered = adjacentVariants(rows)
  for (const family of ['馬马', '門门', '糸糹纟', '金釒钅', '食飠饣']) {
    const members = [...family].map(char => rows.find(row => row.part === char))
    expect(members.every(Boolean)).toBe(true)
    expect(new Set(members.map(row => row.variantGroup)).size).toBe(1)
    const key = members[0].variantGroup
    const positions = ordered.flatMap((row, i) => row.variantGroup === key ? [i] : [])
    expect(positions.at(-1) - positions[0] + 1).toBe(positions.length)
  }
  for (const char of '斗鬥由甲申电甴己已巳甩才刁乡') {
    const row = rows.find(row => row.part === char)
    if (row) expect(row.variantGroup).toBeUndefined()
  }
  expect(rows.find(row => row.part === '斗').variantGroup).toBeUndefined()
  expect(rows.find(row => row.part === '鬥').variantGroup).toBeUndefined()
  expect(rows.filter(row => row.kind === 't' || row.kind === 's').every(row => !row.variantGroup)).toBe(true)
  expect(palette.every(row => !row.variantGroup)).toBe(true)
  for (const count of [3, 4, 6, 8]) {
    const selected = rows.filter(row => row.strokes === count)
    expect(adjacentVariants(selected).every(row => row.strokes === count)).toBe(true)
    expect(new Set(adjacentVariants(selected))).toEqual(new Set(selected))
  }
})

it('keeps the palette usable when forms are absent or cannot be fetched', async () => {
  const palette = [part('馬'), part('木'), part('马')]
  expect(await babelStoneAdapter({ palette }).parts()).toEqual(palette)
  expect(await babelStoneAdapter({ palette, forms: 'forms.tsv', fetch: async () => new Response('', { status: 503 }) }).parts()).toEqual(palette)
  expect(await babelStoneAdapter({ palette, formsText: '马\t馬\tfixture\tvariant' }).parts()).toEqual([
    { ...palette[0], variantGroup: '马' }, palette[1], { ...palette[2], variantGroup: '马' },
  ])
})

it('finds catalog descriptions by component while keeping code point lookups exact', async () => {
  const { matchScriptParts } = await import('../src/core/palette.js')
  const parts = ['木', '⿰木口', '⿱火木', '⿰火口', '𪚴']
  expect(matchScriptParts(parts, '木')).toEqual(['木', '⿰木口', '⿱火木'])
  expect(matchScriptParts(parts, '木', true)).toEqual(['木'])
  expect(matchScriptParts(parts, '⿰木口')).toEqual(['⿰木口'])
  expect(matchScriptParts(parts, '𪚴')).toEqual(['𪚴'])
})
