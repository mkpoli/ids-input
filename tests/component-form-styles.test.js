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
    // The 山 bar forms the box bottom: the box's lowest ink closes at the bar, and the bar keeps
    // 満's native thickness above it. A vertically scaled or floating 山 fails both.
    const edges = []
    let lowest = Infinity
    for (const [ops, points] of data.forms[style]['⿳艹田⿵冂山'][1]) {
      let index = 0, previous
      for (const op of ops.match(/M|L|Q2/g)) {
        const count = op === 'Q2' ? 4 : 2
        const end = points.slice(index + count - 2, index + count)
        lowest = Math.min(lowest, end[1])
        if (op === 'L' && previous[1] === end[1]) {
          edges.push({ y: end[1], width: Math.abs(end[0] - previous[0]) })
        }
        previous = end
        index += count
      }
    }
    const [barTop, thickness, run] = style === 'sans' ? [77, 61, 300] : [109, 29, 100]
    expect(lowest).toBe(-80)
    expect(edges.some(edge => edge.y === barTop && edge.width > run)).toBe(true)
    expect(barTop - lowest).toBeGreaterThan(thickness)
  }
})

it('cuts 黃 at the 八 that 金 repeats', () => {
  for (const style of ['sans', 'serif']) {
    expect(isComponentForm('⿱廿⿱一由', style)).toBe(true)
    // 黃's 八 hangs below y=82 (sans) or y=70 (serif); the form keeps only the crown above it.
    const floor = style === 'sans' ? 82 : 70
    const lowest = Math.min(...componentParts('⿱廿⿱一由', undefined, style)
      .flatMap(item => item.part.contours.flatMap(contour => Array.from(contour.light).filter((_, i) => i % 2 === 1))))
    expect(lowest).toBeGreaterThanOrEqual(floor)
  }
})
