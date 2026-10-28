import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { isComponent, isLetter, isNewKorean, parse, write } from '../src/core/ids.js'
import { characterScript, partScript } from '../src/core/scripts.js'
import { compose } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { hasNewKorean, newKoreanSource } from '../src/composer/new-korean.js'

const points = ['\u{A97D}', '\u{A97E}', '\u{A97F}', '\u{D7C7}', '\u{D7FC}', '\u{D7FD}', '\u{D7FE}']
const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/new-korean-outlines.json.gz', import.meta.url))))

describe('New Korean Orthography letters', () => {
  it('accepts the proposed code points as letters and descriptions', () => {
    for (const char of points) {
      expect(isComponent(char)).toBe(true)
      expect(isLetter(char)).toBe(true)
      expect(characterScript(char)).toBe('hangul')
      expect(isNewKorean(char)).toBe(true)
      expect(parse(`⿰${char}木`).tree).toEqual({ op: '⿰', parts: [char, '木'] })
      expect(write(parse(`⿰${char}木`).tree)).toBe(`⿰${char}木`)
    }
    expect(partScript(`⿰${points[0]}${points[1]}`)).toBe('hangul')
    expect(partScript(`⿰${points[0]}木`)).toBe('mixed')
    expect(isNewKorean('木')).toBe(false)
    // The neighbouring assigned letters stay ordinary Hangul.
    expect(characterScript('\u{A97C}')).toBe('hangul')
  })

  it('ships one outline for every proposed code point', () => {
    expect(Object.keys(outlines.records).sort()).toEqual([...points].sort())
    expect(outlines.font).toBe('IDS New Korean')
    expect(outlines.license).toBe('CC BY-SA 4.0')
    for (const char of points) {
      expect(outlines.records[char].G.d).toBeUndefined()
      expect(outlines.records[char].G.p.length).toBeGreaterThan(0)
      expect(hasNewKorean(`⿰${char}木`)).toBe(true)
      expect(onlyBundled(`⿰${char}⬚`)).toBe(true)
    }
  })

  it('draws them from the bundled outlines', async () => {
    const source = newKoreanSource({ load: async () => outlines })
    for (const char of points) {
      const drawn = await compose(source, `⿰${char}${points[0]}`, { separate: true })
      expect(drawn.origins).toContain(`glyph ${char}`)
      expect(drawn.d.length).toBeGreaterThan(10)
    }
  })

  it('keeps the drawings and the font in step', () => {
    const font = readFileSync(new URL('../fonts/IDSNewKorean.woff2', import.meta.url))
    expect(font.subarray(0, 4).toString()).toBe('wOF2')
    expect(outlines.fontSha256).toBe(createHash('sha256').update(font).digest('hex'))
    const sources = JSON.parse(readFileSync(new URL('../data/new-korean/sources.json', import.meta.url)))
    for (const letter of sources.letters) {
      const file = readFileSync(new URL(`../data/new-korean/${letter.file}`, import.meta.url))
      expect(createHash('sha256').update(file).digest('hex')).toBe(letter.sha256)
    }
  })
})
