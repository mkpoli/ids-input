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
