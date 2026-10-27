import { expect, it } from 'bun:test'
import { characterScript, groupPaletteParts, isOtherScript, partScript } from '../src/core/scripts.js'

it('classifies characters and descriptions using the pinned Unicode scripts', () => {
  for (const [char, group] of [['A', 'latin'], ['3', 'latin'], ['Ж', 'cyrillic'], ['𒖨', 'Pcun'], ['𪚴', 'han'], ['㇒', 'strokes'], ['ㅏ', 'hangul'], ['ㄅ', 'bopomofo'], ['א', 'Hebr'], ['ش', 'Arab']]) expect(characterScript(char)).toBe(group)
  expect(partScript('⿰木口')).toBe('han')
  expect(partScript('⿰木ㄅ')).toBe('mixed')
  expect(partScript('◇')).toBe('symbols')
  expect(partScript('⬚')).toBeNull()
})

it('keeps adapter-supplied parts grouped even when absent from the bundled catalog', () => {
  const parts = [{ part: '𒖨', kind: 'd' }, { part: 'א', kind: 'd' }, { part: '⿰木口', kind: 'c' }, { part: '𘠀', kind: 't' }, { part: '㇒', kind: 's' }, { part: '𽀒', kind: 'seal' }]
  const groups = groupPaletteParts(parts)
  for (const [group, char] of [['Pcun', '𒖨'], ['Hebr', 'א'], ['han', '⿰木口'], ['tangut', '𘠀'], ['strokes', '㇒'], ['seal', '𽀒']]) expect(groups.get(group)?.map(part => part.part)).toContain(char)
})

it('keeps existing palette groups out of Other scripts', () => {
  for (const group of ['han', 'latin', 'cyrillic', 'hangul', 'bopomofo', 'tangut', 'seal', 'strokes', 'symbols', 'mixed']) expect(isOtherScript(group)).toBe(false)
  for (const group of ['Hebr', 'Arab', 'Hira', 'Kana', 'Pcun']) expect(isOtherScript(group)).toBe(true)
})
