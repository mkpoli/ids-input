import { expect, test } from 'bun:test'
import { parse, write } from '../src/core/ids.js'
import { chooseVariation, variationFamiliesOfPart } from '../src/core/variation-families.js'

test('a host with two hidden 幺 exposes both, and preserves its sibling and mark on edit', () => {
  const base = parse('⿰水絲\u0301', {open:true}).tree
  const groups = variationFamiliesOfPart(base).filter(group => group.occurrence)
  expect(groups.map(group => group.occurrence.path)).toEqual([[1,0,0],[1,1,0]])
  const picked = chooseVariation(base, groups[1], 'folded')
  expect(write(picked)).toBe('⿰水⿰糹⿱&VR-5E7A-02;小\u0301')
  const next = variationFamiliesOfPart(picked).filter(group => group.occurrence)
  expect(next.map(group => group.occurrence.form)).toEqual([null,'folded'])
  expect(chooseVariation(picked, next[1], 'folded')).toBeNull()
  expect(write(chooseVariation(picked, next[1], null))).toBe('⿰水⿰糹⿱幺小\u0301')
})

test('a saved alias is selected in its single picker and can be changed', () => {
  const original = '&GW-u5e7a-g;'
  const [family] = variationFamiliesOfPart(original)
  expect(family.forms).toHaveLength(3)
  expect(family.occurrence.form).toBe('folded')
  expect(write(chooseVariation(original, family, 'returning'))).toBe('&VR-5E7A-03;')
})
