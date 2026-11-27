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
    expect(index.patterns.get(entry).join('')).toBe(entry.components ?? '')
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
  expect(choices('⿰日冒', '382').map(f => f.write)).toEqual(['⿰日冒\u{E0100}', '⿰日冐'])
  expect(choices('⿱日月', '305').map(f => f.write)).toContain('⿸日月')
})

it('retains the filled operand in drawings of a positional fragment', () => {
  expect(choices('⿰二月', '47').map(f => f.write)).toContain('⿰&GW-u51ab-01;月')
  expect(choices('⿱雨⿰日月', '307e').map(f => f.write)).toContain('⿰日⿱雨月')
  expect(choices('⿰孛月', '188b').map(f => f.write)).toContain('⿰⿱龸子月')
})

it('keeps the operand inside both extended frames of UCV 444', () => {
  const spellings = choices('⿱此木', '444').map(f => f.write)
  expect(spellings).toEqual(['⿹⿻止⿻一㇂木', '⿹⿻止弋木'])
  for (const text of spellings) expect(choices(text, '444').map(f => f.write)).toContain('⿱此木')
})

it('keeps unrelated catalogue groups out of the picker', () => {
  expect(ucvChoices(index, tree('⿳猫犬牛'))).toEqual([])
})

import { occurrenceChoices } from '../src/core/ucv-choice.js'

it('changes one occurrence inside an encoded host, preserving the other operands and marks', () => {
  for (const [char, source, expected] of [
    ['伴', '⿰亻半', '⿰亻半\u{E0101}'], ['消', '⿰氵肖', '⿰氵肖\u{E0101}'],
    ['楂', '⿰木查', '⿰木査'], ['捨', '⿰扌舍', '⿰扌舎'],
  ]) {
    const forms = occurrenceChoices(index, char + 'ˊ', [source]).flatMap(entry => entry.forms)
    expect(forms.map(form => form.write)).toContain(expected + 'ˊ')
  }
  const forms = occurrenceChoices(index, '林', ['⿰⿱八木⿱八木']).flatMap(e => e.forms.map(f => f.write))
  expect(forms).toContain('⿰⿱丷木⿱八木')
  expect(forms).toContain('⿰⿱八木⿱丷木')
  expect(occurrenceChoices(index, '消\u{E0100}', ['⿰氵肖']).some(e => e.context)).toBe(false)
})

it('uses a deeper expansion and supports catalogue templates at the root of an expansion', () => {
  const hosts = occurrenceChoices(index, '倘', ['⿰亻尚', '⿰亻⿱⺌冋'])
  expect(hosts.flatMap(e => e.forms.map(f => f.write))).toContain('⿰亻⿱&GW-u21b54-03;冋')
  expect(occurrenceChoices(index, '薛', ['⿱艹⿰𠂤辛']).flatMap(e => e.forms.map(f => f.write))).toContain('⿰𠂤⿱艹辛')
})

it('preserves a marked recursive expansion once when it becomes a saved choice', async () => {
  const { decompositionChoices } = await import('../src/svelte/unifiable.svelte.js')
  const text = '⿰亻⿱⺌冋ˊ'
  const splits = decompositionChoices(/** @type {any} */ ({
    picked: '倘ˊ', splits: [], alternatives: { found: [{ operation: 'expand', text, tree: tree(text) }] },
  }))
  expect(occurrenceChoices(index, '倘ˊ', splits).flatMap(e => e.forms.map(f => f.write)))
    .toContain('⿰亻⿱&GW-u21b54-03;冋ˊ')
})

it('offers each entry once, where the least expanded description reaches it', () => {
  const ids = (char, splits) => occurrenceChoices(index, char, splits).map(entry => entry.id)
  expect(ids('肖', ['⿱⺌月', '⿱⺌⿵冂二', '⿱⿰丨八月', '⿱⿲㇒丨丶月'])).toEqual(['28', '417', '21', '53'])
  expect(ids('消', ['⿰氵肖', '⿰氵⿱⺌月'])).toEqual(['430', '28'])
  expect(ids('唇', ['⿱辰口'])).toContain('305')
  expect(ids('次', ['⿰二欠'])).toEqual(['47'])
})

it('reads each spelling of a component in the same place into one entry', () => {
  const forms = occurrenceChoices(index, '肖', ['⿱⺌⺝', '⿱⺌⺼', '⿱⺌月']).filter(entry => entry.id === '53')
  expect(forms.length).toBe(1)
  expect(forms[0].forms.map(form => form.write)).toEqual(['⿱⺌月󠄀', '⿱⺌月󠄁', '⿱⺌舟󠄁', '⿱⺌⺼'])
})

it('opens a component further when none of its entries applies there', () => {
  const ids = splits => occurrenceChoices(index, '𣴎', splits).map(entry => entry.id).sort()
  expect(ids(['⿰氵㒼', '⿰氵⿱廿巾'])).toEqual(ids(['⿰氵⿱廿巾']))
})
