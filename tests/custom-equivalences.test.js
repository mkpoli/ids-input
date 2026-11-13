import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { customsOf, parse, write } from '../src/core/ids.js'
import { createCustomComponents } from '../src/core/custom-components.js'
import { askDrawable } from '../src/core/preview.js'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'
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
      expect(item.status).toBe(item.count >= 2 ? 'verified' : 'candidate')
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

describe('what draws a custom component', () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
  const custom = createCustomComponents(doc)

  it('writes a description with characters, private-use glyphs or descriptions in their place', () => {
    expect(custom.get('{22}').draw).toBe('⿺㇉一')
    expect(custom.drawable('⿹{22}一')).toBe('⿹⿺㇉一一')
    // An entity draws as the number it is confirmed to be, and that as its glyph.
    expect(custom.get('&CDP-8BD0;').draw).toBe(custom.get('{7}').draw)
    expect(custom.drawable('⿱&CDP-8BD0;心').codePointAt(1)).toBe(0xf4f3)
    // A number BabelStone gives no fragment draws as the glyph its font has for it.
    expect([...custom.drawable('⿹{53}一')]).toHaveLength(3)
    expect(custom.drawable('⿹{53}一').codePointAt(1)).toBe(0xf2e7)
    expect(customsOf(parse(custom.drawable('⿱丿⿹#(-𠃌㇉)一')).tree)).toEqual([])
  })

  it('leaves the rest as it is', () => {
    expect(custom.drawable('⿰木木')).toBe('⿰木木')
    expect(custom.drawable('⿰木{9999}')).toBe('⿰木{9999}')
    expect(custom.drawable('⿰{木')).toBe('⿰{木')
    expect(custom.drawable('⿻[1:]丨{22}')).toBe('⿻[1:]丨⿺㇉一')
    for (const row of doc.components) if (row.draw) expect(customsOf(parse(row.draw, { open: true }).tree)).toEqual([])
    expect(doc.counts.drawable).toBe(doc.components.filter(row => row.draw).length)
  })

  it('reaches a preview through the adapter', async () => {
    const adapter = babelStoneAdapter({ table: new Map(), custom: doc })
    expect(await adapter.drawable('⿹{22}一')).toBe('⿹⿺㇉一一')
    const asked = []
    const ask = askDrawable(async text => { asked.push(text); return null }, adapter.drawable)
    await ask('⿹{22}一')
    await ask('⿰木木')
    expect(asked).toEqual(['⿹⿺㇉一一', '⿰木木'])
    expect(askDrawable(undefined, adapter.drawable)).toBeUndefined()
  })
})
