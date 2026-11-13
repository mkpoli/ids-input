import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { parse, write } from '../src/core/ids.js'
import { atoms, besides, createFrame, plainTree, solve, subtract, without } from '../scripts/lib/custom-equivalences.mjs'

/** @param {Record<string, string[]>} rows */
const table = rows => new Map(Object.entries(rows).map(([char, texts]) => [char, texts.map(plainTree)]))
const tree = text => plainTree(text)

describe('a custom component in another table\'s parts', () => {
  const zi = table({ 鸟: ['⿴乌丶'], 乌: ['⿱丿⿹#(-𠃌㇉)一'], 岛: ['⿹⿱丿⿴#(-𠃌㇉)丶山'] })
  const babel = table({ 鸟: ['⿹{53}一'], 岛: ['⿹{53}山'] })

  it('reads a table down to its smallest parts and back to the characters they make', () => {
    const frame = createFrame(zi)
    expect(write(frame.expand('鸟'))).toBe('⿴⿱丿⿹#(-𠃌㇉)一丶')
    expect(write(frame.collapse(tree('⿰木⿱丿⿹#(-𠃌㇉)一')))).toBe('⿰木乌')
  })

  it('takes parts out of a tree, and refuses where the part to take is not the only one', () => {
    expect(write(without(tree('⿴⿱丿⿹#(-𠃌㇉)一丶'), ['一']))).toBe('⿴⿱丿#(-𠃌㇉)丶')
    expect(write(without(tree('⿲木火土'), ['火']))).toBe('⿰木土')
    expect(without(tree('⿰木木'), ['木'])).toBeNull()
    expect(without(tree('⿰木火'), ['水'])).toBeNull()
    expect(atoms(tree('⿰⿾止木'))).toEqual(['⿾止', '木'])
    expect(besides(tree('⿱丿⿹{53}一'), '{53}').map(write)).toEqual(['丿', '一'])
  })

  it('solves the component from the characters both tables describe', () => {
    const found = solve(babel, createFrame(zi))
    expect([...found.get('{53}')]).toEqual([['⿴⿱丿#(-𠃌㇉)丶', ['鸟']], ['⿱丿⿴#(-𠃌㇉)丶', ['岛']]])
  })

  it('writes a subtraction on the part that holds what is taken out', () => {
    const holds = part => part === '{53}' ? ['丿', '#(-𠃌㇉)', '丶'] : [part]
    expect(write(subtract(tree('⿹{53}一'), ['丶'], holds, mine => mine[0]))).toBe('⿹㇯{53}丶一')
    expect(write(subtract(tree('⿹{53}一'), ['一'], holds, mine => mine[0]))).toBe('{53}')
    expect(subtract(tree('⿹{53}一'), ['木'], holds, mine => mine[0])).toBeNull()
  })
})

describe('data/custom-components.json.gz', () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
  const component = text => doc.components.find(row => row.text === text)

  it('lists every custom component of the three tables with its source', () => {
    expect(doc.format).toBe('ids-input/custom-components')
    expect(doc.licence).toBe('GPL-2.0-or-later')
    expect(doc.counts.components).toBe(doc.components.length)
    expect(new Set(doc.components.map(row => row.text)).size).toBe(doc.components.length)
    expect(component('{53}')).toMatchObject({ kind: 'numbered', source: 'babelstone', description: 'outside of 鸟岛 (F2E7)' })
    expect(component('&CDP-8BD0;')).toMatchObject({ kind: 'entity', source: 'chise' })
    expect(component('#(-𠃌㇉)')).toMatchObject({ kind: 'chain', source: 'zi-tools' })
    for (const row of doc.components) for (const item of row.equivalents) {
      expect(['babelstone', 'chise', 'zi-tools']).toContain(item.in)
      expect(item.in).not.toBe(row.source)
      if (item.status === 'verified') expect(item.count).toBeGreaterThanOrEqual(2)
      expect(parse(item.text, { open: true }).problem).toBeUndefined()
    }
  })

  it('says what the outside of 鸟 is in each notation', () => {
    const outside = component('{53}').equivalents
    expect(outside.find(item => item.in === 'chise')).toMatchObject({ text: '&CDP-8964;', status: 'verified' })
    expect(outside.find(item => item.in === 'zi-tools')).toMatchObject({ text: '⿱丿⿴#(-𠃌㇉)丶', status: 'verified', basis: 'difference' })
    expect(component('#(-𠃌㇉)').equivalents.find(item => item.in === 'babelstone')).toMatchObject({ text: '㇯㇯{53}丿丶', basis: 'inverse' })
    expect(component('{53}').subtraction).toMatch(/^㇯.[^{]$/u)
  })

  it('carries the descriptions of characters that follow', () => {
    const of = char => doc.characters.filter(row => row.char === char)
    expect(of('乌').find(row => row.in === 'babelstone')).toMatchObject({ text: '⿹㇯{53}丶一', basis: 'subtraction', of: '㇯鸟丶', from: 'zi-tools' })
    expect(of('鸟').find(row => row.in === 'zi-tools')).toMatchObject({ text: '⿹⿱丿⿴#(-𠃌㇉)丶一', basis: 'substitution', of: '⿹{53}一' })
    for (const row of doc.characters) expect(parse(row.text).problem).toBeUndefined()
    // A character is never said in terms of itself, nor a doubled part taken out once.
    for (const row of doc.characters) expect(row.text.includes(row.char)).toBe(false)
    expect(of('千').some(row => row.basis === 'subtraction' && row.of.startsWith('㇯𠦅'))).toBe(false)
  })

  it('records the stroke letters with their sources', () => {
    expect(doc.strokeLetters.find(row => row.stroke === '㇉')).toEqual({ stroke: '㇉', chain: 'SHSg', sources: ['bai-ids', 'midzchi'] })
    expect(doc.strokeLetters.find(row => row.stroke === '㇛')).toEqual({ stroke: '㇛', chain: 'PD', sources: ['midzchi'] })
    expect(doc.sources.map(source => source.id)).toEqual(['babelstone', 'chise', 'zi-tools', 'bai-ids', 'midzchi'])
  })

  // The zi.tools table is fetched once and cached; without it the build cannot be repeated offline.
  it.skipIf(!existsSync(new URL('../cache/custom-components', import.meta.url)))('is reproduced by its build', () => {
    const run = spawnSync('bun', ['scripts/build_custom_components.mjs', '--check'], { cwd: new URL('..', import.meta.url).pathname })
    expect(run.status).toBe(0)
  }, 120000)
})
