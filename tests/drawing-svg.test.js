import { describe, expect, it } from 'bun:test'
import { drawingSvg } from '../src/core/index.js'

const drawing = { d: 'M0 0L100 0L100 100Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }], stroke: [80, 80] }

describe('a drawing as an SVG file', () => {
  it('fills its ink in the colour asked, transparent by default, without placeholders', () => {
    const svg = drawingSvg(drawing, { ink: '#112233' })
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">')
    expect(svg).toContain('<path d="M0 0L100 0L100 100Z" fill="#112233"/>')
    expect(svg).not.toContain('<rect')
  })
  it('lays a background under it, and pads the box on every side', () => {
    const svg = drawingSvg(drawing, { background: '#fff', padding: 0.1, size: 512 })
    expect(svg).toContain('viewBox="-100 -100 1200 1200" width="512" height="512"')
    expect(svg).toContain('<rect x="-100" y="-100" width="1200" height="1200" fill="#fff"/>')
  })
  it('draws the placeholders only when asked, and masks what ㇯ cuts', () => {
    expect(drawingSvg(drawing, { placeholders: true })).toContain('stroke-dasharray="0 1"')
    const cut = drawingSvg({ d: 'M0 0Z', cut: 'M1 1Z' })
    expect(cut).toContain('<mask id="cut">')
    expect(cut).toContain('mask="url(#cut)"')
  })
  it('keeps a line break or a tab in path data as the separator it is', () => {
    expect(drawingSvg({ d: 'M10\n20\tL30 40Z' })).toContain('<path d="M10 20 L30 40Z"')
  })
  it('refuses a colour that is not a hex colour', () => {
    const svg = drawingSvg(drawing, { ink: 'red"/><script>', background: 'url(x)' })
    expect(svg).toContain('fill="#000000"')
    expect(svg).not.toContain('script')
    expect(svg).not.toContain('url(x)')
    const numbers = drawingSvg({ d: 'M0 0Z', slots: [{ index: 0, box: ['0" onload="x', 0, 100, 100] }] }, { size: '10" onload="x', padding: 'wide', placeholders: true })
    expect(numbers).not.toContain('onload')
    expect(numbers).toContain('viewBox="0 0 1000 1000" width="1000" height="1000"')
    const injected = drawingSvg({ d: 'M0 0"/><script>Z' })
    expect(injected).not.toContain('<script')
    expect(injected.match(/<path [^>]*>/g)).toEqual(['<path d="M0 0sctZ" fill="#000000"/>'])
  })
})

it('includes emoji in SVG output and escapes text', () => {
  const svg = drawingSvg({ d: '', emoji: [{ text: '👩🏽‍💻', box: [0, 0, 500, 1000] }, { text: '<&', box: [500, 0, 500, 1000] }] })
  expect(svg).toContain('>👩🏽‍💻</text>')
  expect(svg).toContain('>&lt;&amp;</text>')
})
