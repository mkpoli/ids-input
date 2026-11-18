import { expect, it } from 'bun:test'
import data from '../data/ucv.json'
import { createUcvIndex } from '../src/core/ucv.js'
import { formSpelling, ucvChoices } from '../src/core/ucv-choice.js'
import { parse, partAt, replaceAt, write } from '../src/core/ids.js'

const index = createUcvIndex(/** @type {import('../src/core/ucv.js').UcvData} */ (data))
const tree = text => parse(text, { open: true }).tree
const choices = (text, id) => ucvChoices(index, tree(text)).find(entry => entry.id === id)?.forms ?? []

it('opens every UCV reference spelling and can choose a sibling', () => {
  for (const entry of index.entries.filter(entry => entry.kind === 'unifiable')) {
    for (const anchor of index.patterns.get(entry)) {
      expect(choices(anchor, entry.id).length, entry.id + ': ' + anchor).toBeGreaterThan(0)
    }
    for (const form of entry.forms) {
      expect(choices(formSpelling(form), entry.id).length, entry.id + ': ' + form.glyph).toBeGreaterThan(0)
    }
  }
})
it('keeps the leaf, its marks and its sibling scoped to the occurrence', () => {
  for (const [src, id, target] of [['半','24','半\u{E0101}'], ['肖','28','肖\u{E0101}'], ['查','115','査'], ['舍','77','舎'], ['丷','22','&GW-u516b-03;']]) {
    const root = tree('⿰' + src + '⬚')
    const forms = ucvChoices(index, partAt(root, [0])).find(e => e.id === id).forms
    expect(write(replaceAt(root, [0], forms.find(f => f.write === target).tree))).toBe('⿰' + target + '⬚')
    expect(choices(src + 'ˊ', id).map(f => f.write)).toContain(target + 'ˊ')
  }
})
it('rebinds operands when the template rearranges them and keeps filled operands out of drawings', () => {
  expect(choices('⿱艹⿰日月', '307c').map(f => f.write)).toContain('⿰日⿱艹月')
  expect(choices('⿰日冒', '382').map(f => f.write)).toEqual(['⿰日冐'])
  expect(choices('⿱日月', '305').map(f => f.write)).toContain('⿸日月')
})
