import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { componentDrawing, isComponentForm } from '../src/composer/component-forms.js'
import { paletteSource } from '../src/composer/palette.js'
import { compose, createSource } from '../src/composer/loader.js'
import { Composer } from '../src/composer/compose.js'
import { files } from './fixtures/composer-export.js'

const forms = JSON.parse(readFileSync(new URL('../data/numbered-forms.json', import.meta.url)))
const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/numbered-sans-outlines.json.gz', import.meta.url))))

describe('numbered component faces', () => {
  it('draws Sans cuts for the unfragmented components, with the 9 failed cuts on the PUA glyph', () => {
    const chars = Object.keys(forms.forms.sans)
    expect(chars).toHaveLength(69)
    expect(chars.sort()).toEqual(Object.keys(outlines.records).sort())
    expect(forms.fallback).toEqual([23, 27, 65, 79, 90, 92, 103, 111, 118])
    for (const char of chars) {
      for (const style of ['sans', 'serif', 'kaisho']) {
        expect(isComponentForm(char, style)).toBe(false)
        const drawn = componentDrawing(char, style)
        expect(drawn?.d.length).toBeGreaterThan(20)
      }
    }
  })

  it('keeps the glyph record reachable for a separated cell drawing', async () => {
    const source = paletteSource({ load: async () => ({ records: outlines.records }) })
    await source.ready()
    const drawn = await compose(source, '⿰\u{F2A9}\u{F2A9}', { separate: true, layout: 'cells', fontStyle: 'sans' })
    expect(drawn.cells).toBe(true)
    expect(drawn.parts.length).toBe(2)
  })

  it('uses the native contextual 葭 cut in a wood sequence', async () => {
    const record = JSON.parse(readFileSync(new URL('../data/numbered-five-context.json', import.meta.url)))
    expect(record.G.b).toEqual([322, -80, 678, 599])
    expect(record.G.p).toHaveLength(2)
    expect(outlines.records['\u{F2A9}'].G.b).not.toEqual(record.G.b)
    const fixture = createSource(async name => files[name] === undefined ? null : new Uint8Array(Buffer.from(files[name])).buffer)
    const source = paletteSource({ load: async () => ({ records: outlines.records }), fallback: fixture })
    await source.ready()
    const drawn = await compose(source, '⿰木\u{F2A9}', { separate: true, fontStyle: 'sans' })
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.parts[1].origin).toContain('\u{F2A9}')
    const [, , width, height] = drawn.parts[1].box
    expect(width / height).toBeCloseTo(356 / 679, 3)
    for (const sequence of ['⿲木\u{F2A9}木', '⿰木⿱木⿰木\u{F2A9}']) {
      const result = await compose(source, sequence, { separate: true, fontStyle: 'sans' })
      const part = result.parts.find(p => p.origin === 'glyph \u{F2A9}')
      expect(part).toBeDefined()
      expect(part.box[2] / part.box[3]).toBeCloseTo(356 / 679, 3)
    }
    const joined = await compose(source, '⿲木\u{F2A9}木', { fontStyle: 'sans' })
    const joinedPart = joined.parts.find(p => p.origin === 'glyph \u{F2A9}')
    expect(joinedPart.box[2] / joinedPart.box[3]).toBeCloseTo(356 / 679, 3)
    // Exercise the learned-host layout even when a host cut is available for the numbered glyph.
    const composer = new Composer(source.store(), { fontStyle: 'sans' })
    composer.predict = () => [[40, -80, 460, 840], [500, -80, 960, 840]]
    const originalHost = composer.host.bind(composer)
    composer.host = (op, i, child, ...args) => {
      if (child === '\u{F2A9}') throw new Error('contextual five must not use the host cut')
      return originalHost(op, i, child, ...args)
    }
    const learned = composer.learned('⿰', ['木', '\u{F2A9}'], [40, -80, 960, 840])
    expect(learned.find(p => p.origin === 'glyph \u{F2A9}').nativeAspect).toBe(true)
    const shares = composer.shares('⿲', ['木', '\u{F2A9}', '木'], [40, -80, 960, 840])
    expect(shares.find(p => p.origin === 'glyph \u{F2A9}').nativeAspect).toBe(true)
    composer.fontStyle = 'serif'
    composer.host = () => null
    const serif = composer.learned('⿰', ['木', '\u{F2A9}'], [40, -80, 960, 840])
    expect(serif.find(p => p.origin === 'glyph \u{F2A9}').nativeAspect).toBeUndefined()
    const standalone = await compose(source, '\u{F2A9}', { separate: true, fontStyle: 'sans' })
    expect(standalone.parts[0].box[2] / standalone.parts[0].box[3]).not.toBeCloseTo(356 / 679, 2)
    const vertical = await compose(source, '⿳木\u{F2A9}木', { separate: true, fontStyle: 'sans' })
    expect(vertical.parts[1].box[2] / vertical.parts[1].box[3]).not.toBeCloseTo(356 / 679, 2)
  })

  it('cuts a Sans shape distinct from the Serif PUA glyph', () => {
    const sans = componentDrawing('\u{F2A9}', 'sans')
    const serif = componentDrawing('\u{F2A9}', 'serif')
    expect(sans.d).not.toBe(serif.d)
  })
})
