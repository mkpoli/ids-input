import { expect, it } from 'bun:test'
import { REPETITION, REPETITION_MIRRORED, repetitionDrawing, repetitionParts } from '../src/composer/repetition.js'
import { bundledSource } from '../src/composer/bundled.js'
import { onlyBundled } from '../src/composer/local.js'
import { compose, createSource, sketch } from '../src/composer/loader.js'
import { groupParts } from '../src/core/preview.js'
import { files } from './fixtures/composer-export.js'

const local = () => bundledSource({ load: async () => ({ records: {} }), matches: () => false })
const remote = () => createSource(async name => {
  const file = files[name]
  return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
})

it('draws both spellings as the same four detached strokes without a Han export', async () => {
  const first = await compose(local(), REPETITION)
  const other = await compose(local(), REPETITION_MIRRORED)
  expect(first.d).toBe(other.d)
  expect(first.d).toBe(repetitionDrawing(REPETITION).d)
  expect(first.d.match(/M/g)).toHaveLength(4)
  expect(first.d).not.toMatch(/NaN|Infinity/)
  expect(first.cut).toBe('')
  expect(first.approximate).toEqual([])
  expect(other.approximate).toEqual([])
  expect(first.origins.every(origin => origin === 'four-dot repetition')).toBe(true)
  const parts = repetitionParts(REPETITION)
  expect(parts[0].target[2]).toBeLessThan(parts[1].target[0])
  expect(parts[2].target[3]).toBeLessThan(parts[1].target[1])
})

it('preserves each spelling’s editable leaves and sketch boxes', async () => {
  for (const [text, count] of [[REPETITION, 3], [REPETITION_MIRRORED, 2]]) {
    const source = local()
    const drawn = await compose(source, text, { separate: true })
    const boxes = await sketch(source, text)
    expect(drawn.parts).toHaveLength(count)
    expect(boxes).toHaveLength(count)
    expect(groupParts(drawn.parts, boxes)?.length).toBe(count)
    expect(drawn.parts.map(part => part.box)).toEqual(boxes.map(part => part.box))
  }
})

it('keeps the specialized form in larger descriptions, including under 口', async () => {
  const source = remote()
  for (const wrap of [text => `⿱口${text}`, text => `⿱⿱口${text}木`, text => `⿰木${text}`]) {
    const first = await compose(source, wrap(REPETITION))
    const other = await compose(source, wrap(REPETITION_MIRRORED))
    expect(first.d).toBe(other.d)
    expect(first.origins).toContain('four-dot repetition')
    expect(first.origins).toContain(wrap(REPETITION).includes('口') ? 'glyph 口' : 'glyph 木')
  }
})

it('recognizes only complete specialized subtrees for local rendering', () => {
  expect(onlyBundled(REPETITION)).toBe(true)
  expect(onlyBundled(REPETITION_MIRRORED)).toBe(true)
  expect(onlyBundled(`⿱⬚${REPETITION}`)).toBe(true)
  expect(onlyBundled(`⿱口${REPETITION}`)).toBe(false)
  expect(onlyBundled('⿰⬚⬚')).toBe(false)
  expect(repetitionParts('⿰冫⿱丿⬚')).toBeNull()
  expect(repetitionParts('⿰冫⿱丿')).toBeNull()
})

it('uses distinct native styles without losing alias equivalence', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const a = await compose(local(), REPETITION, { fontStyle })
    const b = await compose(local(), REPETITION_MIRRORED, { fontStyle })
    expect(a.d).toBe(b.d)
    expect(a.d.match(/M/g)).toHaveLength(4)
    expect(a.d).toBe(repetitionDrawing(REPETITION, fontStyle).d)
  }
  expect(repetitionDrawing(REPETITION, 'sans').d).not.toBe(repetitionDrawing(REPETITION, 'serif').d)
})

it('uses native complete glyphs for the recorded 塁 and 疂 descriptions', async () => {
  for (const bottom of ['土', '冝']) for (const fontStyle of ['sans', 'serif']) {
    const text = `⿳田${REPETITION}${bottom}`
    expect(onlyBundled(text)).toBe(true)
    const a = await compose(local(), text, { fontStyle })
    const b = await compose(local(), `⿳田${REPETITION_MIRRORED}${bottom}`, { fontStyle })
    expect(a.d).toBe(b.d)
    expect(a.parts).toHaveLength(1)
    expect(a.approximate).toEqual([])
  }
})

it('keeps native atomic forms from becoming a single adjustable operand', async () => {
  for (const text of ['⿱宀儿', '⿻三丨', '⿻者丶', `⿳田${REPETITION}土`]) {
    const source = local()
    const drawn = await compose(source, text, { separate: true })
    const boxes = await sketch(source, text)
    expect(boxes.length).toBeGreaterThan(drawn.parts.length)
    expect(groupParts(drawn.parts, boxes)).toBeNull()
  }
})

it('retains three designed groups for the six-stroke component in either style', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const source = local()
    const drawn = await compose(source, '⿳士冖一', { separate: true, fontStyle })
    const boxes = await sketch(source, '⿳士冖一', { fontStyle })
    expect(drawn.parts).toHaveLength(3)
    expect(groupParts(drawn.parts, boxes)).toHaveLength(3)
    expect(drawn.parts[2].box[2] - drawn.parts[2].box[0]).toBeLessThan(drawn.parts[1].box[2] - drawn.parts[1].box[0])
  }
})


it('keeps designed component strokes at native thickness', async () => {
  const { componentParts } = await import('../src/composer/component-forms.js')
  for (const style of ['sans', 'serif']) {
    const parts = componentParts('⿳士冖一', undefined, style)
    for (const part of parts) {
      expect(part.target).toEqual(part.source)
      expect(part.target[2] - part.target[0]).toBeCloseTo(part.source[2] - part.source[0], 6)
      expect(part.target[3] - part.target[1]).toBeCloseTo(part.source[3] - part.source[1], 6)
    }
    const root = await compose(local(), '⿳士冖一', { fontStyle: style })
    expect(root.parts[2].box[2]).toBeCloseTo(parts[2].source[2] - parts[2].source[0], 1)
  }
})


it('combines the intact 士冖 crown above 一 in both equivalent descriptions', async () => {
  const { componentParts } = await import('../src/composer/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const crown = componentParts('⿱士冖', undefined, fontStyle)
    const whole = componentParts('⿳士冖一', undefined, fontStyle)
    expect(whole.slice(0, 2).map(p => p.target)).toEqual(crown.map(p => p.target))
    expect(whole[2].target[3]).toBeLessThan(whole[1].target[1])
    const a = await compose(local(), '⿳士冖一', { fontStyle, separate: true })
    const b = await compose(local(), '⿱⿱士冖一', { fontStyle, separate: true })
    expect(a.d).toBe(b.d)
    expect(groupParts(b.parts, await sketch(local(), '⿱⿱士冖一', { fontStyle }))).toHaveLength(3)
  }
})

it('draws the upper component of 興 locally with two editable operands in both styles', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const source = local()
    expect(onlyBundled('⿴𦥑同')).toBe(true)
    const { componentParts } = await import('../src/composer/component-forms.js')
    if (fontStyle === 'serif') expect(componentParts('⿴𦥑同', undefined, fontStyle)[0].source[2]).toBeLessThanOrEqual(900)
    const drawn = await compose(source, '⿴𦥑同', { fontStyle, separate: true })
    const leaves = await sketch(source, '⿴𦥑同', { fontStyle })
    expect(drawn.parts).toHaveLength(2)
    expect(groupParts(drawn.parts, leaves)).toHaveLength(2)
    expect(drawn.approximate).toEqual([])
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    const nested = await compose(remote(), '⿱⿴𦥑同木', { fontStyle })
    expect(nested.origins.some(origin => origin.includes('⿴𦥑同'))).toBe(true)
  }
})

it('keeps the four-bar component separated into two adjustable columns', async () => {
  const { componentParts } = await import('../src/composer/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const parts = componentParts('⿰二二', undefined, fontStyle)
    expect(parts[1].target[0] - parts[0].target[2]).toBeGreaterThan(100)
    const source = local()
    const drawn = await compose(source, '⿰二二', { fontStyle, separate: true })
    expect(drawn.d.match(/M/g)).toHaveLength(4)
    expect(groupParts(drawn.parts, await sketch(source, '⿰二二', { fontStyle }))).toHaveLength(2)
  }
})

it('renders the connected-stroke upper part of 卑 without its bottom 十', async () => {
  const { componentParts, componentDrawing } = await import('../src/composer/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const source = local(), text = '⿱㇒⿻日丿'
    expect(onlyBundled(text)).toBe(true)
    const parts = componentParts(text, undefined, fontStyle)
    expect(parts).toHaveLength(1)
    expect(parts[0].source[1]).toBeGreaterThanOrEqual(170)
    expect(parts[0].source[0]).toBeGreaterThan(100)
    expect(parts[0].target).toEqual(parts[0].source)
    const drawn = await compose(source, text, { fontStyle, separate: true })
    expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    expect(groupParts(drawn.parts, await sketch(source, text, { fontStyle }))).toBeNull()
  }
})
