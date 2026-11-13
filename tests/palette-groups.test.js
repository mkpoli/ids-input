import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { adjacentGroups } from '../src/core/palette.js'
import { babelStoneAdapter, paletteRows } from '../src/adapter/babelstone.js'

const part = (text, group, strokes = 4) => ({ part: text, kind: 'c', strokes, ...(group ? { group: group } : {}) })
it('keeps families at their first frequency position without changing literal forms', () => {
  const rows = [part('木'), part('釒', '金'), part('水'), part('钅', '金'), part('金', '金'), part('氵', '水'), part('火')]
  rows[2].group = '水'
  const ordered = adjacentGroups(rows)
  expect(ordered.map(row => row.part)).toEqual(['木', '釒', '钅', '金', '水', '氵', '火'])
  expect(ordered[1]).toBe(rows[1])
  expect(rows.map(row => row.part)).toEqual(['木', '釒', '水', '钅', '金', '氵', '火'])
  expect(adjacentGroups(ordered)).toEqual(ordered)
  expect(adjacentGroups(rows.filter(row => ['金', '木'].includes(row.part))).map(row => row.part)).toEqual(['木', '金'])
})

it('groups shipped traditional, simplified and positional forms using the supplied table', async () => {
  const palette = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))))
  const formsText = readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8')
  const rows = await babelStoneAdapter({ palette, formsText }).parts()
  const ordered = adjacentGroups(rows)
  for (const family of ['馬马', '門门', '糸糹纟', '金釒钅', '食飠饣']) {
    const members = [...family].map(char => rows.find(row => row.part === char))
    expect(members.every(Boolean)).toBe(true)
    expect(new Set(members.map(row => row.group)).size).toBe(1)
    const key = members[0].group
    const positions = ordered.flatMap((row, i) => row.group === key ? [i] : [])
    expect(positions.at(-1) - positions[0] + 1).toBe(positions.length)
  }
  for (const char of '斗鬥由甲申电甴己已巳甩才刁乡') {
    const row = rows.find(row => row.part === char)
    if (row) expect(row.group).toBeUndefined()
  }
  expect(rows.find(row => row.part === '斗').group).toBeUndefined()
  expect(rows.find(row => row.part === '鬥').group).toBeUndefined()
  expect(rows.filter(row => row.kind === 't' || row.kind === 's').every(row => !row.group)).toBe(true)
  expect(palette.filter(row => row.group).every(row => row.kind === 'c' || row.kind === 'd')).toBe(true)
  for (const count of [3, 4, 6, 8]) {
    const selected = rows.filter(row => row.strokes === count)
    expect(adjacentGroups(selected).every(row => row.strokes === count)).toBe(true)
    expect(new Set(adjacentGroups(selected))).toEqual(new Set(selected))
  }
})

it('places Unicode look-alikes beside each other and joins them with variant families', async () => {
  const palette = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))))
  const formsText = readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8')
  const rows = await babelStoneAdapter({ palette, formsText }).parts()
  const ordered = adjacentGroups(rows)
  for (const family of ['口囗', '土士', '日曰', '未末', '冂⺆', '戶户戸']) {
    const members = [...family].map(char => rows.find(row => row.part === char))
    expect(new Set(members.map(row => row?.group)).size).toBe(1)
    const positions = ordered.flatMap((row, i) => row.group === members[0].group ? [i] : [])
    expect(positions.at(-1) - positions[0] + 1).toBe(positions.length)
  }
  expect(paletteRows({ columns: ['part', 'kind'], parts: [['口', 'c'], ['木', 'c'], ['囗', 'd']], lookalikes: ['口囗'] }))
    .toEqual([{ part: '口', kind: 'c', group: '口' }, { part: '木', kind: 'c' }, { part: '囗', kind: 'd', group: '口' }])
})

it('keeps the palette usable when forms are absent or cannot be fetched', async () => {
  const palette = [part('馬'), part('木'), part('马')]
  expect(await babelStoneAdapter({ palette }).parts()).toEqual(palette)
  expect(await babelStoneAdapter({ palette, forms: 'forms.tsv', fetch: async () => new Response('', { status: 503 }) }).parts()).toEqual(palette)
  expect(await babelStoneAdapter({ palette, formsText: '马\t馬\tfixture\tvariant' }).parts()).toEqual([
    { ...palette[0], group: '马' }, palette[1], { ...palette[2], group: '马' },
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
