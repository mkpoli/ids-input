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
import { compose, sketch } from '@han-compose/composer/loader'

// The bundled outlines ship with the engine's package.
const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../node_modules/@han-compose/composer/data/sources/${name}/outlines.json.gz`, import.meta.url))))
const bopomofo = data('bopomofo')
const unicode = name => JSON.parse(gunzipSync(readFileSync(new URL(`../node_modules/@han-compose/composer/data/unicode/outlines/${name.slice('unicode/'.length)}.json.gz`, import.meta.url))))
const source = () => unicodeSource({ load: unicode, fallback: bopomofoSource({ load: async () => bopomofo }) })

describe('sketching loose marks', () => {
  it('puts each leaf where the drawing puts it beside a mark', async () => {
    const local = source()
    const boxes = await sketch(local, '⿰ㄅㄚˇ')
    const plain = await sketch(local, '⿰ㄅㄚ')
    const drawn = await compose(local, '⿰ㄅㄚˇ')
    const ink = drawn.parts.filter(part => !part.origin.startsWith('mark'))
    expect(boxes[1].box[1]).toBeGreaterThan(plain[1].box[1])
    // The leaf's box holds the ink the drawing placed in it.
    expect(boxes[1].box[1]).toBeLessThanOrEqual(ink[1].box[1] + 1)
    expect(boxes[0].box[0] + boxes[0].box[2]).toBeLessThanOrEqual(plain[0].box[0] + plain[0].box[2])
  })
})
