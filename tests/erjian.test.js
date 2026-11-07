import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { erjianDrawing, erjianEntry, hasErjian } from '../src/composer/erjian.js'
import { drawingSvg } from '../src/core/preview.js'
import { EXAMPLE_GROUPS } from '../demo/lib/examples.js'

const data = JSON.parse(readFileSync(new URL('../data/erjian-glyphs.json', import.meta.url), 'utf8'))
/** The examples whose form the draft drew whole. */
const covered = Object.keys(data)

describe('the draft glyphs of the 二简字 forms', () => {
  it('answers for the descriptions it holds, and no others', () => {
    for (const sequence of covered) expect(hasErjian(sequence)).toBe(true)
    for (const sequence of ['⿰木子', '⿱艹半丙', '', '⿰忄']) expect(hasErjian(sequence)).toBe(false)
    expect(erjianDrawing('⿰木子')).toBeNull()
  })
  it('names the table entry and the character each form was made for', () => {
    expect(erjianEntry('⿰忄井')).toEqual({ table: '2.2:033', character: '警', codepoint: 'U+F082' })
    expect(erjianEntry('⿸厂九')?.table).toBe('2.2:034')
  })
  it('draws one whole glyph, with nothing to cut, lay out or place', () => {
    for (const sequence of covered) {
      const drawing = erjianDrawing(sequence)
      expect(drawing?.cut).toBe('')
      expect(drawing?.slots).toEqual([])
      expect(drawing?.parts).toEqual([])
      expect(drawing?.origins?.[0]).toBe(`erjian ${data[sequence].table}`)
      expect(drawing?.d.startsWith('M')).toBe(true)
      expect(drawing?.d).not.toMatch(/NaN|Infinity/)
      expect(drawing?.d).toMatch(/^[MLQHV CZmlqhvcz0-9.-]+$/)
    }
  })
  it('renders as a filled path, with no placeholder or text', () => {
    const svg = drawingSvg(erjianDrawing('⿰忄井'), { size: 200 })
    expect(svg).toContain('<path d="M')
    expect(svg).not.toContain('<text')
    expect(svg).not.toContain('slot')
  })
  it('covers the table, not only the examples', () => {
    const examples = EXAMPLE_GROUPS.flatMap(group => group.examples)
    const loose = covered.filter(sequence => !examples.some(example => example.sequence === sequence))
    expect(loose.length).toBeGreaterThan(30)
    for (const sequence of ['⿰讠旦', '⿱𥫗布', '⿸厂九']) expect(hasErjian(sequence)).toBe(true)
  })
  it('names the character of each 二简字 example whose form the draft drew', () => {
    const group = EXAMPLE_GROUPS.find(group => group.key === 'erjian')
    for (const example of group.examples) {
      if (hasErjian(example.sequence)) expect(erjianEntry(example.sequence)?.character).toBe(example.char)
    }
    // 弹 and 数 are in the table but BabelStone Han PUA draws no glyph for either.
    expect(group.examples.filter(example => !hasErjian(example.sequence)).map(example => example.sequence).sort()).toEqual(['⿱由攵', '⿱甲弓'])
  })
  it('leaves out a form whose parts the table leaves unnamed', () => {
    for (const sequence of covered) expect(sequence).not.toContain('？')
  })
})
