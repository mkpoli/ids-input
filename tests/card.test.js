import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { cardSvg, PALETTES, sequenceLayout } from '../worker/card.js'
import { OPERATORS } from '../src/core/ids.js'

const drawing = { d: 'M0 0L100 0L100 100Z' }
const sequenceCells = svg => [...svg.matchAll(/<text data-sequence="true" x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>(.*?)<\/text>/g)]

describe('a workshop share card', () => {
  it('uses the workshop palette in both schemes', () => {
    const css = readFileSync(new URL('../demo/app.css', import.meta.url), 'utf8')
    const aliases = { subtle: 'surface-2', strong: 'line-strong', soft: 'accent-soft' }
    for (const [token, value] of Object.entries(PALETTES.light)) {
      expect(css).toContain(`--${aliases[token] ?? token}:light-dark(${value},${PALETTES.dark[token]})`)
    }
    for (const theme of ['light', 'dark']) {
      const svg = cardSvg({ sequence: '⿰木子', drawing, theme })
      expect(svg).toContain(`fill="${PALETTES[theme].ink}"`)
      expect(svg).toContain(`stroke="${PALETTES[theme].accent}"`)
      expect(svg).not.toContain('#b3402c')
      expect(svg).not.toContain('#f4efe4')
    }
  })
  it('frames the composed drawing and identifies its sequence and code point', () => {
    const svg = cardSvg({ sequence: '⿰釒哥', drawing, char: '鎶' })
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"')
    expect(svg).toContain('<path d="M0 0L100 0L100 100Z" fill="#1c1c22"/>')
    expect(svg).toContain('IDS Workshop')
    expect(svg).toContain('ids.mkpo.li')
    expect(svg).toContain('U+93B6')
  })
  it('renders every IDC as a text glyph, never a button icon', () => {
    for (const [operator] of OPERATORS) {
      const svg = cardSvg({ sequence: operator + '木', drawing })
      expect(svg).toContain(`>${operator}</text>`)
      expect(sequenceCells(svg)).toHaveLength(2)
      expect(svg).not.toContain('<g transform="translate')
    }
  })
  it('labels unavailable previews and unknown code points without a false Unicode claim', () => {
    const svg = cardSvg({ sequence: '⿰木' })
    expect(svg).toContain('Preview unavailable')
    expect(svg).toContain('No Unicode match')
    expect(svg).not.toContain('U+')
  })
  it('keeps seven characters on one line', () => {
    const cells = sequenceCells(cardSvg({ sequence: '⿰⿱日月モ木子' }))
    expect(cells).toHaveLength(7)
    expect(new Set(cells.map(cell => cell[2])).size).toBe(1)
  })
  it('fits continuously and wraps before making the text too small', () => {
    expect(sequenceLayout('木'.repeat(7)).size).toBe(77.1)
    expect(sequenceLayout('木'.repeat(8)).size).toBe(67.5)
    expect(sequenceLayout('木'.repeat(18)).lines).toHaveLength(2)
    expect(sequenceLayout('木'.repeat(18)).size).toBe(60)
    expect(sequenceLayout('木'.repeat(45)).lines).toHaveLength(3)
    expect(sequenceLayout('木'.repeat(45)).truncated).toBe(false)
    for (let count = 1; count <= 200; count++) {
      const layout = sequenceLayout('木'.repeat(count))
      expect(layout.size).toBeGreaterThanOrEqual(26)
      if (count > 1) expect(layout.size).toBeLessThanOrEqual(sequenceLayout('木'.repeat(count - 1)).size)
      expect(layout.lines.length).toBeLessThanOrEqual(3)
      for (const line of layout.lines) expect(line.length * layout.size).toBeLessThanOrEqual(540)
      expect(layout.lines.flat().join('')).toBe(layout.truncated ? '木'.repeat(59) + '…' : '木'.repeat(count))
    }
  })
  it('spells out sequence and typesets Unicode as secondary metadata', () => {
    const svg = cardSvg({ sequence: '⿰釒哥', char: '鎶' })
    expect(svg).toContain('>Ideographic description sequence</text>')
    expect(svg).toContain('>Unicode</text>')
    expect(svg).toContain('data-codepoint="true"')
    expect(svg).not.toContain('width="164" height="44"')
  })
  it('bounds long sequences and ends with an ellipsis', () => {
    const cells = sequenceCells(cardSvg({ sequence: '木'.repeat(200) }))
    expect(cells).toHaveLength(60)
    expect(cells.at(-1)[4]).toBe('…')
    for (const [, x, y, size] of cells) {
      expect(Number(x) + Number(size) / 2).toBeLessThanOrEqual(1108)
      expect(Number(y)).toBeGreaterThan(210)
      expect(Number(y)).toBeLessThan(350)
    }
  })
  it('keeps combining marks in the same cell', () => {
    const cells = sequenceCells(cardSvg({ sequence: 'か゚' }))
    expect(cells).toHaveLength(1)
    expect(cells[0][4]).toBe('か゚')
  })
  it('escapes sequence text and font attributes', () => {
    const svg = cardSvg({ sequence: '<&>', familyOf: () => 'a"<b' })
    expect(svg).toContain('>&lt;</text>')
    expect(svg).toContain('>&amp;</text>')
    expect(svg).toContain('>&gt;</text>')
    expect(svg).toContain('font-family="a&quot;&lt;b"')
  })
})
