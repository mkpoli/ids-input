import { test, expect } from 'bun:test'
import { insertAt } from '../src/svelte/insertion.js'
import { parse, write } from '../src/core/ids.js'
const insert = (text, offset, part, operator) => write(insertAt(parse(text, {open:true}).tree, text, offset, part, operator).tree)
test('caret fills explicit and implicit slots', () => {
  expect(insert('⿰⬚木',1,'水')).toBe('⿰水木')
  expect(insert('⿰木',2,'水')).toBe('⿰木水')
  expect(insert('',0,'水')).toBe('水')
})
test('caret extends pairs in the parent orientation', () => {
  expect(insert('⿰木水',2,'火')).toBe('⿲木火水')
  expect(insert('⿱木水',3,'火')).toBe('⿳木水火')
  expect(insert('⿰木水',1,'火')).toBe('⿲火木水')
})
test('caret preserves surround and full triple structure with a local pair', () => {
  expect(insert('⿴囗木',2,'火')).toBe('⿴囗⿰火木')
  expect(insert('⿳木水火',3,'日')).toBe('⿳木水⿱日火')
  expect(insert('⿰木水',0,'火')).toBe('⿰火⿰木水')
})
test('caret never splits supplementary characters or their selector', () => {
  expect(insert('⿰𠀀\u{E0100}水',3,'火')).toBe('⿲𠀀\u{E0100}火水')
})
test('inserting an operator wraps the adjacent subtree', () => {
  expect(insert('⿰⿱木水火',1,null,'⿴')).toBe('⿰⿴⿱木水⬚火')
})
