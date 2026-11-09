import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import {
  applyOperator, isDescription, isMark, isMarks, marksOf, normalizeMarks, parse, place, splitDescription,
  unwrap, withMarks, withoutMarks, write,
} from '../src/core/index.js'
import { drawingSvg } from '../src/core/preview.js'
import { tokens } from '../src/svelte/tokens.js'
import { bopomofoSource } from '@han-compose/composer/bopomofo'
import { unicodeSource } from '@han-compose/composer/unicode'
import { hasUnicodeGlyph } from '@han-compose/composer/unicode'
import { onlyBundled } from '@han-compose/composer/local'
import { sourceFor, traitsOf } from '@han-compose/composer/source'
import { compose, sketch } from '@han-compose/composer/loader'

// The bundled outlines ship with the engine's package.
const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../node_modules/@han-compose/composer/data/sources/${name}/outlines.json.gz`, import.meta.url))))
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
