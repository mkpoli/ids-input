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


it('keeps detached components at native stroke thickness instead of enlarging their crop', async () => {
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
