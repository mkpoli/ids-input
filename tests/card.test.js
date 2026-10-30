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
  it('drops to two lines and cuts an ellipsis on a line too long for the column', () => {
    const svg = cardSvg({ sequence: '⿰'.repeat(80) + '木' })
    expect(svg.match(/<text /g)?.length).toBeLessThan(20)
    expect(svg).toContain('…')
    for (const y of [...svg.matchAll(/ y="(\d+)"/g)].map(match => Number(match[1]))) expect(y).toBeLessThan(630)
  })
  it('escapes a sequence that is markup', () => {
    const svg = cardSvg({ sequence: '<&>' })
    expect(svg).toContain('>&lt;</text>')
    expect(svg).toContain('>&amp;</text>')
    expect(svg).toContain('>&gt;</text>')
  })
})
