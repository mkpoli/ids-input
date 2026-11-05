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

describe('splitting an Emoji from its marks', () => {
  it('keeps an Emoji sequence whole', () => {
    const emoji = '👩🏽‍💻'
    expect(marksOf(emoji)).toBe('')
    expect(withoutMarks(emoji)).toBe(emoji)
    expect(withoutMarks(`${emoji}ˊ`)).toBe(emoji)
    expect(marksOf(`${emoji}ˊ`)).toBe('ˊ')
  })
})
