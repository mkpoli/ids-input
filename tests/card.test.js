import { describe, expect, it } from 'bun:test'
import { cardSvg } from '../worker/card.js'

const drawing = { d: 'M0 0L100 0L100 100Z' }

describe('a card', () => {
  it('draws the frame, the drawing and the sequence', () => {
    const svg = cardSvg({ sequence: '⿰釒哥', drawing, char: '鎶' })
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"')
    expect(svg).toContain('<path d="M0 0L100 0L100 100Z" fill="#17171b"/>')
    expect(svg).toContain('IDS WORKSHOP')
    expect(svg).toContain('ids.mkpo.li')
    expect(svg).toContain('U+93B6')
  })
  it('sets an operator as its icon, not as the character', () => {
    const svg = cardSvg({ sequence: '⿰木', drawing })
    expect(svg).toMatch(/<g transform="translate\(6\d\d /)
    expect(svg).not.toContain('>⿰</text>')
    expect(svg).toContain('>木</text>')
  })
  it('marks the empty frame where nothing was drawn', () => {
    expect(cardSvg({ sequence: '⿰木' })).toContain('>⬚</text>')
  })
  it('keeps seven characters on one line', () => {
    const svg = cardSvg({ sequence: '⿰⿱日月モ木子' })
    // Five characters set as text on one baseline, two operators as icons beside them.
    expect(svg.match(/<text [^>]*font-size="60"/g)).toHaveLength(5)
    expect(svg.match(/<g transform=/g)).toHaveLength(2)
    expect([...svg.matchAll(/<text [^>]*y="(\d+)"[^>]*font-size="60"/g)].map(match => match[1])).toEqual(Array(5).fill('300'))
  })
  it('cuts an ellipsis once nothing fits, and stays inside the card', () => {
    const sequence = '木'.repeat(200)
    const svg = cardSvg({ sequence })
    expect(svg).toContain('…')
    expect(svg).not.toContain('木'.repeat(200))
    for (const [, x, y] of svg.matchAll(/<text x="(\d+)" y="(\d+)"/g)) {
      expect(Number(x)).toBeLessThan(1136)
      expect(Number(y)).toBeLessThan(630)
    }
  })
  it('sets a base with its marks in one cell', () => {
    const svg = cardSvg({ sequence: 'か゚' })
    expect(svg).toContain('>か゚</text>')
    expect(svg.match(/<text x="6\d\d" y="300"/g)?.length).toBe(1)
  })
  it('escapes a sequence that is markup', () => {
    const svg = cardSvg({ sequence: '<&>' })
    expect(svg).toContain('>&lt;</text>')
    expect(svg).toContain('>&amp;</text>')
    expect(svg).toContain('>&gt;</text>')
  })
})
