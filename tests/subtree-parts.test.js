import { expect, it } from 'bun:test'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { subtrees, frequencies, strokeCounter, MANUAL_PARTS, manualUses, build } from '../scripts/build_subtree_parts.mjs'
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
  expect(compounds).toHaveLength(17)
  expect(compounds.find(row => row[0] === '⿰冫⿱丿丶')).toEqual(['⿰冫⿱丿丶', 113, 4, 1, null, 'c'])
  for (const [text, uses, strokes, derived, , kind] of compounds) {
    expect(parse(text).problem).toBeUndefined()
    if (MANUAL_PARTS.includes(text)) expect(uses).toBe(113)
    else expect(uses).toBeGreaterThanOrEqual(30)
    expect(strokes).toBeGreaterThan(0)
    expect(derived).toBe(1)
    expect(kind).toBe('c')
    const tree = parse(text).tree
    expect(write(replaceAt(parse('⿰木水').tree, [1], tree))).toBe(`⿰木${text}`)
    expect(report.parts.find(row => row[0] === (MANUAL_PARTS.includes(text) ? '{11}' : text))?.[1]).toBe(uses)
  }
})

it('counts source placeholders and literal shortcuts once per character', () => {
  const table = parseIdsTable('甲\t⿱口{11}(G) ⿱口⿰冫⿱丿丶(T)\n乙\t⿰{11}{11}(G)\n丙\t⿱口{110}(G)')
  expect(manualUses(table, '⿰冫⿱丿丶')).toBe(2)
})

it('keeps raw counts when a literal manual shortcut crosses the frequency cutoff', () => {
  const root = mkdtempSync(`${tmpdir()}/ids-subtrees-`)
  try {
    mkdirSync(`${root}/data`)
    const lines = Array.from({ length: 50 }, (_, i) => `${String.fromCodePoint(0x4e00 + i)}\t⿱口⿰冫⿱丿丶(G)`)
    lines.push('乙\t⿱口{11}(G)')
    writeFileSync(`${root}/data/babelstone-ids.tsv.gz`, gzipSync(lines.join('\n')))
    writeFileSync(`${root}/data/ids-parts.json`, JSON.stringify({ parts: [['冫', 0, 2, 0, null, 'd'], ['丿', 0, 1, 0, null, 's'], ['丶', 0, 1, 0, null, 's']] }))
    build(pathToFileURL(root + '/'))
    const palette = JSON.parse(readFileSync(`${root}/data/ids-parts.json`))
    const report = JSON.parse(gunzipSync(readFileSync(`${root}/data/ids-subtrees.json.gz`)))
    expect(palette.parts.find(row => row[0] === '⿰冫⿱丿丶')[1]).toBe(51)
    expect(report.parts.find(row => row[0] === '⿰冫⿱丿丶')[1]).toBe(50)
  } finally { rmSync(root, { recursive: true, force: true }) }
})


it('normalizes exact encoded shortcuts without losing source counts or IDS search aliases', () => {
  const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
  const report = JSON.parse(gunzipSync(readFileSync(new URL('../data/ids-subtrees.json.gz', import.meta.url))))
  for (const [ids, char] of Object.entries(palette.subtrees.encoded)) {
    expect(palette.parts.filter(row => row[0] === char)).toHaveLength(1)
    expect(palette.parts.some(row => row[0] === ids)).toBe(false)
    expect(report.parts.some(row => row[0] === ids)).toBe(true)
  }
  const table = parseIdsTable('甲\t⿰宂⿱宀儿(G)\n乙\t⿱口⿱宀儿(G)\n丙\t⿰宂木(G)')
  expect(manualUses(table, '宂', ['⿱宀儿'])).toBe(3)
})


it('counts all regional aliases of an encoded component without overwriting or doubling uses', () => {
  const root = mkdtempSync(`${tmpdir()}/ids-subtrees-aliases-`)
  try {
    mkdirSync(`${root}/data`)
    const lines = Array.from({ length: 35 }, (_, i) => `${String.fromCodePoint(0x5000 + i)}\t⿱口⿱艹罒(G) ⿱口⿱卝罒(T)`)
    lines.push('乙\t⿰木⿱艹罒(G)', '丙\t⿰木⿱卝罒(T)', '丁\t⿰木𦭝(G)')
    writeFileSync(`${root}/data/babelstone-ids.tsv.gz`, gzipSync(lines.join('\n')))
    writeFileSync(`${root}/data/ids-parts.json`, JSON.stringify({ parts: [['𦭝', 0, 9, 0, '豎', 'd'], ['艹', 0, 4, 0, '豎', 'd'], ['卝', 0, 4, 0, '豎', 'd'], ['罒', 0, 5, 0, '豎', 'd']] }))
    build(pathToFileURL(root + '/'))
    const first = readFileSync(`${root}/data/ids-parts.json`, 'utf8')
    expect(JSON.parse(first).parts.find(row => row[0] === '𦭝')[1]).toBe(38)
    build(pathToFileURL(root + '/'))
    expect(readFileSync(`${root}/data/ids-parts.json`, 'utf8')).toBe(first)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
