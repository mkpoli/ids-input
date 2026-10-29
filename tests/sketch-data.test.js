import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { rank, readSketchTemplates, shapesOf } from '../src/core/index.js'
import { babelStoneAdapter, paletteRows, smallSealAdapter } from '../src/adapter/index.js'
import { sketchParts } from '../src/svelte/sketch-templates.js'

const document = JSON.parse(gunzipSync(readFileSync(new URL('../data/sketch-parts.json.gz', import.meta.url))))
const templates = readSketchTemplates(document)

/** A stroke from percentage coordinates. */
const strokes = lines => lines.map(line => line.map(([x, y]) => ({ x, y })))
const found = (lines, count) => rank(shapesOf(strokes(lines)), templates, { limit: 24, strokes: count }).map(t => t.part)

describe('the prepared sketch shapes', () => {
  it('hold the palette parts with two shapes each', () => {
    expect(document.format).toBe('ids-input/sketch-parts')
    expect(document.size).toBe(40)
    expect(templates.length).toBeGreaterThan(780)
    for (const template of templates) {
      expect([...template.part].length).toBe(1)
      expect(template.shapes.length).toBeGreaterThan(0)
      expect(template.shapes.length).toBeLessThanOrEqual(2)
      for (const shape of template.shapes) {
        expect(shape.mask.length).toBe(40 * 40)
        expect(shape.points.length).toBe(shape.ink)
      }
    }
    expect(templates.some(t => t.part === '口')).toBe(true)
    expect(templates.some(t => t.part === '氵')).toBe(true)
  })
  it('find the parts their drawings show', () => {
    expect(found([[[32, 10], [32, 90]], [[32, 10], [68, 10], [68, 90]], [[32, 50], [68, 50]], [[32, 90], [68, 90]]], 4)).toContain('日')
    expect(found([[[15, 40], [85, 40]], [[50, 8], [50, 92]], [[50, 40], [15, 85]], [[50, 40], [85, 85]]], 4)).toContain('木')
    expect(found([[[20, 20], [20, 80]], [[20, 20], [80, 20], [80, 80]], [[20, 80], [80, 80]]], 3)).toContain('口')
  })
  it('refuses a file of another format', () => {
    expect(() => readSketchTemplates({ ...document, version: 2 })).toThrow()
    expect(() => readSketchTemplates({ ...document, size: 32 })).toThrow()
  })
  it('rejects a part with no usable mask and accepts one with only a stretched mask', () => {
    const [part, strokes, uses, stretched] = document.parts[0]
    expect(() => readSketchTemplates({ ...document, parts: [[part, strokes, uses, null, null]] })).toThrow('no usable mask')
    expect(readSketchTemplates({ ...document, parts: [[part, strokes, uses, stretched, null]] })[0].shapes).toHaveLength(1)
  })
})

describe('an adapter with prepared sketches', () => {
  it('answers sketchTemplates without the page fonts', async () => {
    const adapter = babelStoneAdapter({ palette: [], sketches: document })
    expect(adapter.sketchTemplates).toBeFunction()
    expect(await adapter.sketchTemplates()).toEqual([])
  })
  it('keeps only the parts a host palette holds, with its counts', async () => {
    const adapter = babelStoneAdapter({ palette: [
      { part: '木', strokes: 9, uses: 1, kind: 'c' },
      { part: '口', strokes: 3, uses: 3991, kind: 'c' },
      { part: 'host-only', strokes: 1, uses: 1, kind: 'c' },
    ], sketches: document })
    const found = await adapter.sketchTemplates()
    expect(found.map(t => t.part).sort()).toEqual(['口', '木'])
    expect(found.find(t => t.part === '木')?.strokes).toBe(9)
    expect(found.find(t => t.part === '木')?.uses).toBe(1)
  })
  it('reads a gzipped URL', async () => {
    const gzip = readFileSync(new URL('../data/sketch-parts.json.gz', import.meta.url))
    const adapter = babelStoneAdapter({ sketches: `data:application/gzip;base64,${gzip.toString('base64')}` })
    expect((await adapter.sketchTemplates()).length).toBe(templates.length)
  })
  it('filters a Small Seal-only palette too', async () => {
    const adapter = smallSealAdapter({ data: { format: 1, parts: [], modern: {}, table: {} }, sketches: document })
    expect(await adapter.sketchTemplates()).toEqual([])
  })
  it('retries the palette after a failure instead of caching all parts', async () => {
    let calls = 0
    const adapter = babelStoneAdapter({
      parts: 'https://example.test/parts.json', sketches: document,
      fetch: async () => { calls++; return new Response('', { status: 503 }) },
    })
    await expect(adapter.sketchTemplates()).rejects.toThrow()
    await expect(adapter.sketchTemplates()).rejects.toThrow()
    expect(calls).toBe(2)
  })
  it('leaves sketchTemplates out without sketches', () => {
    expect(babelStoneAdapter({ palette: [] }).sketchTemplates).toBeUndefined()
  })
})

describe('prepared shapes and the palette', () => {
  it('agree on every part, its strokes and its uses', () => {
    const palette = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))))
    const wanted = sketchParts(palette)
    const by = new Map(templates.map(template => [template.part, template]))
    for (const part of wanted) {
      const template = by.get(part.part)
      if (part.part === '䶹') { expect(template).toBeUndefined(); continue }
      expect(template).toBeDefined()
      expect(template?.strokes).toBe(part.strokes ?? null)
      expect(template?.uses).toBe(part.uses ?? 0)
    }
  })
})
