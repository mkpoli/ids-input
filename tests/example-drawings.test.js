import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { EXAMPLES, EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

const data = JSON.parse(readFileSync(new URL('../demo/lib/example-drawings.json', import.meta.url), 'utf8'))

describe('the prepared example drawings', () => {
  it('come from the composer export the demo uses', () => {
    expect(data.base).toBe(COMPOSER_BASE)
    expect(data.composer.commit).toMatch(/^[0-9a-f]{7,}$/)
    expect(data.composer.style).toBe('sans')
  })
  it('prepare the proposed 図 with 도', () => {
    expect(data.drawings['⿴口도'].drawn.d.length).toBeGreaterThan(10)
  })
  it('prepares every digit, hentaigana, Latin and Bopomofo example', () => {
    for (const sequence of ['⿰扌3', '⿰𛂦方', '⿰亻A', '⿰木⿳ㄙㄨㄥ', '⿰木⿱ㄅㄞ', '⿰木き']) {
      const drawn = data.drawings[sequence]?.drawn
      expect(drawn?.d.length).toBeGreaterThan(100)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
      const expected = { '⿰扌3': 2, '⿰𛂦方': 2, '⿰亻A': 2, '⿰木⿳ㄙㄨㄥ': 4, '⿰木⿱ㄅㄞ': 3, '⿰木き': 2 }
      expect(drawn.parts).toHaveLength(expected[sequence])
    }
    expect(data.drawings['⿰扌3'].drawn.origins).toContain('glyph 3')
    expect(data.drawings['⿰𛂦方'].drawn.origins).toContain('glyph 𛂦')
    expect(data.drawings['⿰亻A'].drawn.origins).toContain('glyph A')
    expect(data.drawings['⿰木⿳ㄙㄨㄥ'].drawn.origins).toEqual(expect.arrayContaining(['glyph ㄙ', 'glyph ㄨ', 'glyph ㄥ']))
    expect(data.drawings['⿰木⿱ㄅㄞ'].drawn.origins).toEqual(expect.arrayContaining(['glyph ㄅ', 'glyph ㄞ']))
  })
  it('prepares the proposed unencoded Hangul with a diamond initial', () => {
    const drawing = data.drawings['⿱⿰◇ㅏㄴ']?.drawn
    expect(drawing.origins).toEqual(['glyph ◇', 'glyph ㅏ', 'glyph ㄴ'])
    expect(drawing.parts).toHaveLength(3)
    expect(drawing.d.length).toBeGreaterThan(100)
  })
  it('holds exactly the current examples', () => {
    const held = [...Object.keys(data.drawings), ...data.failed.map(entry => entry.sequence)]
    expect(held.sort()).toEqual(EXAMPLES.map(example => example.sequence).sort())
  })
  it('answer every example, or say why it was skipped', () => {
    const skipped = new Map(data.failed.map(entry => [entry.sequence, entry]))
    for (const example of EXAMPLES) {
      const cached = data.drawings[example.sequence]
      if (cached) {
        expect(cached.char).toBe(example.char)
        expect(cached.drawn.d.length).toBeGreaterThan(10)
      } else {
        expect(skipped.has(example.sequence)).toBe(true)
        expect(skipped.get(example.sequence).name).toBeString()
      }
    }
  })
})

it('prepares the additional enclosure, kana and musical forms', () => {
  for (const sequence of ['⿺辶說', '⿱龹幸', '⿶む子', '〾⿱⿰大⿱七六⿵勹五', '⿰⿱興興⿱興興', '⿱七⿰七七', '⿺克千']) {
    const drawn = data.drawings[sequence]?.drawn
    expect(drawn?.d.length).toBeGreaterThan(100)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
  }
  expect(data.drawings['⿶む子'].drawn.origins).toEqual(expect.arrayContaining(['glyph む', 'glyph 子']))
  expect(data.drawings['〾⿱⿰大⿱七六⿵勹五'].drawn.approximate).toContain('〾')
})


it('prepares the examples of reflection, rotation and subtraction', () => {
  for (const sequence of ['⿰⿾臣臣', '⿱或⿿或', '㇯豕㇒']) {
    const drawn = data.drawings[sequence]?.drawn
    expect(drawn?.d.length).toBeGreaterThan(100)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    // These attested forms have matching glyphs; cards need no subtractive mask.
    expect(drawn.cut).toBe('')
  }
})

it('prepares every Tangut example with bundled outlines', () => {
  const examples = EXAMPLE_GROUPS.find(group => group.key === 'tangut').examples
  for (const { sequence, char } of examples) {
    const cached = data.drawings[sequence]
    expect(cached?.char).toBe(char)
    expect(cached?.drawn.d.length).toBeGreaterThan(100)
    expect(cached.drawn.d).not.toMatch(/NaN|Infinity/)
  }
})

it('prepares the Small Seal examples with bundled outlines', () => {
  const examples = EXAMPLE_GROUPS.find(group => group.key === 'seal').examples
  for (const { sequence } of examples) {
    const drawn = data.drawings[sequence]?.drawn
    expect(drawn?.d.length).toBeGreaterThan(100)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
  }
})

it('prepares the Geba examples and their letters', () => {
  const examples = EXAMPLE_GROUPS.find(group => group.key === 'geba').examples
  for (const { sequence } of examples) {
    const drawn = data.drawings[sequence]?.drawn
    expect(drawn?.d.length).toBeGreaterThan(100)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    if (/[A-Z]/.test(sequence)) expect(drawn.origins).toEqual(expect.arrayContaining([expect.stringMatching(/^glyph [A-Z]$/)]))
  }
  expect(data.drawings['⿰言ギ'].drawn.origins).toContain('glyph ギ')
})
