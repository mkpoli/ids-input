import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import {
  applyOperator, isDescription, isMark, isMarks, marksOf, normalizeMarks, parse, place, splitDescription,
  unwrap, withMarks, withoutMarks, write,
} from '../src/core/index.js'
import { drawingSvg } from '../src/core/preview.js'
import { tokens } from '../src/svelte/tokens.js'
import { bopomofoSource } from '../src/composer/bopomofo.js'
import { unicodeSource } from '../src/composer/unicode.js'
import { hasUnicodeGlyph } from '../src/composer/unicode.js'
import { onlyBundled } from '../src/composer/local.js'
import { sourceFor, traitsOf } from '../src/composer/source.js'
import { compose, sketch } from '../src/composer/loader.js'

const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}-outlines.json.gz`, import.meta.url))))
const bopomofo = data('bopomofo')
const unicode = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/unicode-outlines/${name.slice('unicode/'.length)}.json.gz`, import.meta.url))))
const source = () => unicodeSource({ load: unicode, fallback: bopomofoSource({ load: async () => bopomofo }) })

describe('a tone mark on a syllable drawn from the bundled outlines', () => {
  it('asks for the bundled outlines of the tone mark', () => {
    expect(traitsOf('⿰ㄅㄚ\u302E').loose).toBe(true)
    expect(onlyBundled('⿰ㄅㄚ\u302E')).toBe(true)
    expect(onlyBundled('⿰ㄅ木\u302E')).toBe(false)
  })
  it('draws the tone mark', async () => {
    const drawn = await compose(sourceFor('⿰ㄅㄚ\u302E', { bundled: true }), '⿰ㄅㄚ\u302E')
    expect(drawn.parts.map(part => part.origin)).toContain('mark \u302E')
  })
})
