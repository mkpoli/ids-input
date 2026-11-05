import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { cardSvg, PALETTES, sequenceLayout } from '../worker/card.js'
import { OPERATORS } from '../src/core/ids.js'

const drawing = { d: 'M0 0L100 0L100 100Z' }
const sequenceCells = svg => [...svg.matchAll(/<text data-sequence="true" x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>(.*?)<\/text>/g)]

describe('a workshop share card', () => {
  it('uses the workshop palette in both schemes', () => {
    const css = readFileSync(new URL('../design/tokens.css', import.meta.url), 'utf8')
    const aliases = { bg: 'canvas', subtle: 'surface-sunken', muted: 'ink-muted', line: 'border', strong: 'border-strong', soft: 'accent-soft' }
    for (const [token, value] of Object.entries(PALETTES.light)) {
      expect(css).toContain(`--ui-color-${aliases[token] ?? token}: light-dark(${value}, ${PALETTES.dark[token]})`)
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
  it('asks the font table for every cell, the operators included', () => {
    // The table answers IDS Operators for an operator and the character's own face for a character;
    // a face is never assembled here.
    const svg = cardSvg({ sequence: '⿰设冓', char: '講', units: ['講', '设', '冓'], drawings: [drawing, drawing, drawing], familyOf: c => (c === '⿰' ? 'IDS Operators' : c === '设' || c === '冓' ? 'a' : 'b') })
    expect(svg).toContain('font-family="IDS Operators" font-size="88"')
    expect(svg).toContain('font-family="a" font-size="88"')
    expect(svg).not.toContain('font-family="a, IDS Operators"')
  })
  it('keeps the face the table gives an operator, including one the IDC face lacks', () => {
    const svg = cardSvg({ sequence: '⿺木子', familyOf: () => 'IDS Strokes' })
    expect(svg).toContain('font-family="IDS Strokes" font-size="88"')
  })
  it('shows the character of a sequence read with one it does not compose, at that code point', () => {
    const svg = cardSvg({ sequence: '⿰设冓', char: '講', units: ['講', '设', '冓'], drawings: [drawing, drawing, drawing] })
    expect(svg).toContain('Characters of the description, each drawn on its own')
    expect(svg).toContain('>講</text>')
    expect(svg).toContain('U+8B1B')
    expect(svg.match(/data-character="true"/g)).toHaveLength(1)
  })

  it('draws a shared document with its scoped layers and title', () => {
    const scopes = { root: { kind: 'component', node: 'root', positive: [{ d: 'M0 0L100 0L100 100Z' }], negative: [] }, complete: true, issues: [], leafFrames: new Map() }
    const svg = cardSvg({ sequence: '⿰木口', document: { scopes, title: 'Moved 木' } })
    expect(svg).toContain('>Shared document</text>')
    expect(svg).toContain('>Document</text>')
    expect(svg).toContain('data-document="true"')
    expect(svg).toContain('Moved 木')
    expect(svg).toContain('<svg x="106" y="172" width="348" height="348" viewBox="-16 -16 1032 1032">')
    expect(svg).toContain('M0 0L100 0L100 100Z')
    expect(svg).not.toContain('data-character="true"')
    expect(svg).not.toContain('data-codepoint="true"')
  })
  it('falls back to the sequence drawing when a document has no scoped drawing', () => {
    const svg = cardSvg({ sequence: '⿰木口', drawing, document: { scopes: null, title: null } })
    expect(svg).toContain('>Shared document</text>')
    expect(svg).toContain('<path d="M0 0L100 0L100 100Z" fill="#1c1c22"/>')
    expect(svg).not.toContain('data-document="true"')
  })
  it('names a sequence with no character instead of leaving its character row blank', () => {
    const svg = cardSvg({ sequence: '⿺廴占', drawing })
    expect(svg).toContain('>Composes</text>')
    expect(svg).toContain('No character at this code point')
    expect(svg).not.toContain('data-character="true"')
  })
  it('puts the character left of its code point even when it has none', () => {
    const svg = cardSvg({ sequence: '⿰木子', char: '子' })
    const row = svg.slice(svg.indexOf('data-character="true"'), svg.indexOf('data-codepoint'))
    expect(row).toContain('>子</text>')
    const none = cardSvg({ sequence: '⿰木', drawing, char: '设', codepoint: 'U+8BBE', familyOf: () => 'IDS Operators' })
    expect(none).toContain('>设</text>')
    expect(none).toContain('U+8BBE')
    expect(none).toContain('data-codepoint="true"')
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
    expect(svg).toContain('No character at this code point')
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
