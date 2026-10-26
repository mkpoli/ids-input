import { describe, expect, it } from 'bun:test'
import { groupParts, partTransform } from '../src/core/preview.js'
import { drawingSvg } from '../src/core/index.js'

const left = { index: 0, box: [0, 0, 500, 1000], empty: false }
const right = { index: 1, box: [500, 0, 500, 1000], empty: false }
const piece = box => ({ box, d: `M${box[0]} ${box[1]}Z` })

describe('grouping a drawing by leaf', () => {
  it('gives each filled leaf its pieces and the box around them', () => {
    const parts = [piece([10, 20, 390, 880]), piece([520, 40, 460, 920])]
    expect(groupParts(parts, [left, right])).toEqual([
      { index: 0, parts: [0], box: [10, 20, 390, 880] },
      { index: 1, parts: [1], box: [520, 40, 460, 920] },
    ])
  })
  it('keeps the several pieces of one leaf together', () => {
    const parts = [piece([10, 20, 400, 400]), piece([10, 500, 400, 900]), piece([520, 40, 980, 960])]
    expect(groupParts(parts, [left, right]).map(group => group.parts)).toEqual([[0, 1], [2]])
  })
  it('follows reading order when leaves share one box, as an overlay does', () => {
    const overlay = [{ index: 0, box: [0, 0, 1000, 1000], empty: false }, { index: 1, box: [0, 0, 1000, 1000], empty: false }]
    expect(groupParts([piece([0, 0, 1000, 500]), piece([0, 500, 1000, 500])], overlay).map(group => group.parts)).toEqual([[0], [1]])
  })
  it('gives a piece inside an enclosure to the inner leaf, not the whole box around it', () => {
    const outer = { index: 0, box: [0, 0, 1000, 1000], empty: false }
    const inner = { index: 1, box: [200, 200, 500, 500], empty: false }
    const outerPiece = piece([0, 0, 1000, 1000]), innerPiece = piece([250, 250, 400, 400])
    expect(groupParts([outerPiece, innerPiece], [outer, inner]).map(group => group.parts)).toEqual([[0], [1]])
  })
  it('refuses a piece that lies in two leaves, or a leaf with no piece', () => {
    expect(groupParts([piece([0, 0, 1000, 1000])], [left, right])).toBeNull()
    expect(groupParts([piece([10, 20, 390, 880])], [left, right])).toBeNull()
    expect(groupParts([piece([10, 20, 390, 880])], [left, { ...right, empty: true }])).toEqual([
      { index: 0, parts: [0], box: [10, 20, 390, 880] },
    ])
  })
  it('has nothing to group without parts or leaves', () => {
    expect(groupParts([], [left, right])).toBeNull()
    expect(groupParts([piece([0, 0, 10, 10])], [])).toBeNull()
  })
})

describe('a part transform', () => {
  it('turns, scales and moves about the part box centre', () => {
    expect(partTransform({ dx: -5, dy: 10, scale: 0.8, rotate: 15 }, [0, 0, 100, 200]))
      .toBe('translate(-5 10) translate(50 100) rotate(15) scale(0.8) translate(-50 -100)')
  })
  it('is empty when nothing changes, and ignores values that are not numbers', () => {
    expect(partTransform({}, [0, 0, 100, 200])).toBe('')
    expect(partTransform({ dx: 0, dy: 0, scale: 1, rotate: 0 }, [0, 0, 100, 200])).toBe('')
    expect(partTransform({ dx: 'wide', scale: 'big' }, [0, 0, 100, 200])).toBe('')
  })
})

const drawing = {
  d: 'M0 0ZM1 1Z',
  parts: [{ origin: 'glyph 木', box: [0, 0, 500, 1000], d: 'M0 0Z', cut: false }, { origin: 'glyph 口', box: [500, 0, 500, 1000], d: 'M1 1Z', cut: false }],
}

describe('a drawing with adjusted parts as an SVG file', () => {
  it('writes each part separately when a transform is given, keeping the unadjusted ones', () => {
    const svg = drawingSvg({ ...drawing, transforms: ['translate(-5 10)', null] })
    expect(svg).not.toContain('M0 0ZM1 1Z')
    expect(svg).toContain('<g transform="translate(-5 10)"><path d="M0 0Z" fill="#000000"/></g>')
    expect(svg).toContain('<path d="M1 1Z" fill="#000000"/>')
  })
  it('stays merged when no transform is set, or when ㇯ cuts across parts', () => {
    expect(drawingSvg({ ...drawing, transforms: [null, null] })).toContain('<path d="M0 0ZM1 1Z"')
    const cut = drawingSvg({ ...drawing, cut: 'M2 2Z', transforms: ['translate(1 1)', null] })
    expect(cut).toContain('<mask id="cut">')
    expect(cut).toContain('<path d="M0 0ZM1 1Z" fill="#000000" mask="url(#cut)"/>')
    expect(cut).not.toContain('<g transform=')
  })
  it('keeps only transform syntax in a transform string', () => {
    const svg = drawingSvg({ ...drawing, transforms: ['translate(1 2)"/><script>alert(1)</script>', null] })
    expect(svg).not.toContain('<script')
    expect(svg).toContain('<g transform="translate(1 2)scriptalert(1)script"')
  })
})
