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

describe('loose marks', () => {
  it('reads combining marks, modifier letters, tone marks and superscripts, and nothing else', () => {
    for (const char of ['\u0301', '\u0323', 'ˊ', 'ˇ', 'ˉ', '˙', '˪', '˫', '˥', '꜀', '゛', '゙', '〮', '〯', '¹', '⁴', 'ʰ']) {
      expect([char, isMark(char)]).toEqual([char, true])
    }
    for (const char of ['木', 'a', '^', '~', '+', '1', '？', '⬚', '⿰']) expect([char, isMark(char)]).toEqual([char, false])
    expect(isMarks('ˊˇ')).toBe(true)
    expect(isMarks('ˊ木')).toBe(false)
    expect(isMarks('')).toBe(false)
  })

  it('keeps them at the end of a description, on the whole of it', () => {
    expect(parse('⿰亻木ˊ').tree).toEqual({ op: '⿰', parts: ['亻', '木'], marks: 'ˊ' })
    expect(write(parse('⿰亻木ˊ').tree)).toBe('⿰亻木ˊ')
    expect(write(parse('⿰ㄅㄚˇˋ').tree)).toBe('⿰ㄅㄚˇˋ')
    expect(write(parse('⿰ㄅ⬚ˊ', { open: true }).tree)).toBe('⿰ㄅ⬚ˊ')
    expect(parse('⿰亻木ˊ').tree.marks).toBe('ˊ')
    expect(parse('⿰\u0378木ˊ').problem).toBe('component')
    expect(parse('⿰亻木a').problem).toBe('extra')
    // A mark where an operand is still due fills it, as it always did.
    expect(write(parse('⿰ㄅˊ').tree)).toBe('⿰ㄅˊ')
    expect(parse('⿰亻ˊ木').problem).toBe('extra')
    expect(isDescription('⿰亻木ˊ')).toBe(true)
    expect(isDescription('ˊ')).toBe(false)
  })

  it('tells the description apart from the marks it ends with', () => {
    expect(splitDescription('⿰亻木ˊ')).toEqual({ base: '⿰亻木', marks: 'ˊ' })
    expect(splitDescription('⿰ㄅㄚˇ¹')).toEqual({ base: '⿰ㄅㄚ', marks: 'ˇ¹' })
    expect(splitDescription('⿰ㄅˊ')).toEqual({ base: '⿰ㄅˊ', marks: '' })
    expect(splitDescription('木ˊ')).toEqual({ base: '木', marks: 'ˊ' })
    expect(splitDescription('')).toEqual({ base: '', marks: '' })
    expect(marksOf('木ˊ')).toBe('ˊ')
    expect(withoutMarks('木ˊ')).toBe('木')
    expect(marksOf('ˊ')).toBe('')
    expect(withMarks('木', 'ˊ')).toBe('木ˊ')
    expect(withMarks({ op: '⿰', parts: ['亻', '木'] }, 'ˊ')).toEqual({ op: '⿰', parts: ['亻', '木'], marks: 'ˊ' })
  })

  it('hoists marks an edit would leave inside back to the root, in reading order', () => {
    const tree = { op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'], marks: 'ˇ' }] }
    expect(normalizeMarks(tree)).toEqual({ op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }], marks: 'ˇ' })
    const marked = parse('⿰亻木ˊ').tree
    expect(write(applyOperator(marked, null, '⿱').tree)).toBe('⿱⿰亻木⬚ˊ')
    expect(write(applyOperator(marked, [], '⿱').tree)).toBe('⿱亻木ˊ')
    expect(write(unwrap(parse('⿱木口ˋ', { open: true }).tree, []))).toBe('木ˋ')
    const placed = place(parse('⿰亻木').tree, [1], parse('水ˇ', { open: true }).tree)
    expect(write(placed.tree)).toBe('⿰亻水ˇ')
  })

  it('keeps a child mark before the marks of the node that holds it', () => {
    const tree = { op: '⿰', parts: ['木', { op: '⿱', parts: ['七', '口'], marks: 'ˇ' }], marks: 'ˊ' }
    expect(write(normalizeMarks(tree))).toBe('⿰木⿱七口ˇˊ')
  })

  it('gives the whole description one token in the field, marks included', () => {
    const spans = tokens('⿰亻木ˊ')
    expect(spans[0]).toMatchObject({ path: [], start: 0, end: 4, text: '⿰' })
    expect(spans.map(token => token.text)).toEqual(['⿰', '亻', '木', 'ˊ'])
    expect(spans.at(-1)).toMatchObject({ path: [], start: 3, end: 4, text: 'ˊ' })
    expect(tokens('木ˊ').map(token => token.text)).toEqual(['木', 'ˊ'])
  })
})

describe('drawing loose marks', () => {
  it('draws a tone mark after the whole syllable, at the upper right', async () => {
    const local = source()
    const plain = await compose(local, '⿰ㄅㄚ')
    const marked = await compose(local, '⿰ㄅㄚˊ')
    expect(marked.origins).toEqual(['glyph ㄅ', 'glyph ㄚ', 'mark ˊ'])
    expect(marked.parts).toHaveLength(3)
    const mark = marked.parts[2]
    // Boxes are [x, y, width, height], y down in the drawing's 1000-unit box.
    expect(mark.origin).toBe('mark ˊ')
    expect(mark.box[0] + mark.box[2]).toBeGreaterThan(700)
    expect(mark.box[1]).toBeLessThan(200)
    expect(mark.d.length).toBeGreaterThan(0)
    expect(marked.d.length).toBeGreaterThan(plain.d.length)
    const svg = drawingSvg(marked)
    expect(svg).not.toMatch(/NaN|Infinity|<text/)
  })

  it('keeps a run of marks in their order and inside the drawing', async () => {
    const local = source()
    const drawn = await compose(local, '⿰ㄅㄚ˥˧')
    expect(drawn.origins).toEqual(['glyph ㄅ', 'glyph ㄚ', 'mark ˥', 'mark ˧'])
    for (const part of drawn.parts) {
      expect(part.box[0]).toBeGreaterThanOrEqual(0)
      expect(part.box[1]).toBeGreaterThanOrEqual(0)
      expect(part.box[0] + part.box[2]).toBeLessThanOrEqual(1000)
      expect(part.box[1] + part.box[3]).toBeLessThanOrEqual(1000)
    }
  })

  it('attaches a combining mark over the drawing and a Hangul tone mark at the left', async () => {
    const local = source()
    const acute = await compose(local, '⿰ㄅㄚ\u0301')
    const over = acute.parts.at(-1)
    expect(over.origin).toBe('mark \u0301')
    // Centered: the mark's box straddles the middle of the 1000-unit box.
    expect(over.box[0]).toBeLessThan(500)
    expect(over.box[0] + over.box[2]).toBeGreaterThan(500)
    expect(over.box[3]).toBeLessThan(250)
    const tone = await compose(local, '⿰ㄅㄚ〮')
    const left = tone.parts.at(-1)
    expect(left.origin).toBe('mark 〮')
    expect(left.box[0]).toBeLessThan(200)
  })

  it('fits long mark runs inside the drawing box', async () => {
    const local = source()
    for (const sequence of ['⿰ㄅㄚ' + '\u0301'.repeat(16), '⿰ㄅㄚ' + '\u0301'.repeat(4) + 'ˊ', '⿰ㄅㄚ〯〯〯']) {
      const drawn = await compose(local, sequence)
      for (const part of drawn.parts) {
        const [x, y, width, height] = part.box
        expect([sequence, part.origin, x >= 0 && y >= 0 && x + width <= 1000 && y + height <= 1000]).toEqual([sequence, part.origin, true])
      }
    }
  })

  it('sketches the description alone and judges bundled data with the marks', async () => {
    const local = source()
    expect(await sketch(local, '⿰ㄅㄚˊ')).toHaveLength(2)
    expect(onlyBundled('⿰ㄅㄚˊ')).toBe(true)
    expect(hasUnicodeGlyph('ˊ')).toBe(true)
    expect(onlyBundled('⿰ㄅㄚˊ木')).toBe(false)
  })
})
