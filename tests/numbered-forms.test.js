import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { componentDrawing, isComponentForm } from '../src/composer/component-forms.js'
import { paletteSource } from '../src/composer/palette.js'
import { compose } from '../src/composer/loader.js'

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

  it('cuts a Sans shape distinct from the Serif PUA glyph', () => {
    const sans = componentDrawing('\u{F2A9}', 'sans')
    const serif = componentDrawing('\u{F2A9}', 'serif')
    expect(sans.d).not.toBe(serif.d)
  })
})
