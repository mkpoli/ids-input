import { expect, it } from 'bun:test'
import data from '../src/composer/component-forms.json'
import { componentDrawing, componentParts, componentRecord, containsComponentForm, isComponentForm, isGroupedForm } from '../src/composer/component-forms.js'
import { onlyBundled } from '../src/composer/local.js'
import { compose } from '../src/composer/loader.js'
import { constants } from './fixtures/composer-export.js'

it('does not use Noto-only forms for Kaisho capabilities or outlines', () => {
  for (const text of ['⿱丿乚', '⿸⿳亠㐅厂生', '㇯馬灬']) {
    expect(isComponentForm(text, 'sans')).toBe(true)
    expect(isComponentForm(text, 'serif')).toBe(true)
    expect(isComponentForm(text, 'kaisho')).toBe(false)
    expect(isGroupedForm(text, 'kaisho')).toBe(false)
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(false)
    expect(componentRecord(text, 'kaisho')).toBeNull()
    expect(componentParts(text, undefined, 'kaisho')).toBeNull()
    expect(componentDrawing(text, 'kaisho')).toBeNull()
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(false)
  }
})

it('loads the internal operands of a Noto-only form for Kaisho', async () => {
  const requests = []
  const stop = new Error('stop after initial file selection')
  const source = {
    ready: async () => {}, manifest: { constants },
    filesOf: keys => { requests.push(...keys); return [] },
    load: async () => { throw stop },
  }
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'kaisho' })).rejects.toThrow(stop.message)
  expect(requests).toContain('丿')
  expect(requests).toContain('乚')
  requests.length = 0
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'sans' })).rejects.toThrow(stop.message)
  expect(requests).not.toContain('丿')
  expect(requests).not.toContain('乚')
})

it('recognizes only explicit Kaisho forms and credits their native font', () => {
  for (const [text, groups] of Object.entries(data.forms.kaisho ?? {})) {
    expect(isComponentForm(text, 'kaisho')).toBe(true)
    expect(isGroupedForm(text, 'kaisho')).toBe(groups.length > 1)
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(true)
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(true)
    const parts = componentParts(text, undefined, 'kaisho')
    expect(parts).toHaveLength(groups.length)
    expect(parts.every(part => part.origin.includes('Kureedo') && part.origin.endsWith(`: ${text}`))).toBe(true)
    expect(componentDrawing(text, 'kaisho').d).not.toMatch(/NaN|Infinity/)
  }
})

it('draws 萬 with the bottom of 両 as one prepared form', () => {
  for (const style of ['sans', 'serif']) {
    expect(isComponentForm('⿳艹田⿵冂山', style)).toBe(true)
    expect(isGroupedForm('⿳艹田⿵冂山', style)).toBe(true)
    const drawing = componentDrawing('⿳艹田⿵冂山', style)
    expect(drawing.d).not.toMatch(/NaN|Infinity/)
    expect(componentParts('⿳艹田⿵冂山', undefined, style)).toHaveLength(2)
    // The horizontal bar retains 満's native contextual 山 thickness.
    const [ops, points] = data.forms[style]['⿳艹田⿵冂山'][1][0]
    const edges = []
    let index = 0, previous
    for (const op of ops.match(/M|L|Q2/g)) {
      const count = op === 'Q2' ? 4 : 2
      const end = points.slice(index + count - 2, index + count)
      if (op === 'L' && previous[1] === end[1]) {
        edges.push({ y: end[1], left: Math.min(previous[0], end[0]), right: Math.max(previous[0], end[0]) })
      }
      previous = end
      index += count
    }
    // Both boundaries must overlap over a substantial part of the bar.
    // This rejects the formerly vertically scaled, thin horizontal stroke.
    const [bottomY, topY, thickness] = style === 'sans' ? [86, 144, 58] : [95, 124, 29]
    const bottom = edges.filter(edge => edge.y === bottomY)
    const top = edges.filter(edge => edge.y === topY)
    expect(bottom.some(a => top.some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) >= 80 && b.y - a.y === thickness))).toBe(true)
  }
})
