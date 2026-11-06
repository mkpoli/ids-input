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
import { compose, sketch } from '../src/composer/loader.js'

const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}-outlines.json.gz`, import.meta.url))))
const bopomofo = data('bopomofo')
const unicode = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/unicode-outlines/${name.slice('unicode/'.length)}.json.gz`, import.meta.url))))
const source = () => unicodeSource({ load: unicode, fallback: bopomofoSource({ load: async () => bopomofo }) })

describe('a mark beside an empty slot', () => {
  it('splits off the slot and draws the mark', async () => {
    expect(splitDescription('⬚́')).toEqual({ base: '⬚', marks: '́' })
    const drawn = await compose(source(), '⬚́')
    expect(drawn.slots).toHaveLength(1)
    expect(drawn.parts.at(-1).origin).toBe('mark ́')
  })
})
