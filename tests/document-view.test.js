import { describe, expect, it } from 'bun:test'
import { fromSequence, scopesMarkup, scopesSvg } from '../src/document/index.js'
import { documentView } from '../src/composer/index.js'

const square = (x, width) => `M${x} 0L${x + width} 0L${x + width} 1000L${x} 1000Z`
const sketch = boxes => boxes.map((box, index) => ({ index, box, empty: false }))
const drawing = parts => ({ parts })
const boxes = [[0, 0, 500, 1000], [500, 0, 500, 1000]]
const parts = [{ leaf: 0, d: square(0, 500) }, { leaf: 1, d: square(500, 500) }]

describe('a document view', () => {
  it('derives source, scopes and frames together', () => {
    const document = fromSequence('⿰木口')
    const view = documentView(document, drawing(parts), sketch(boxes))
    expect(view.complete).toBe(true)
    expect(view.issues).toEqual([])
    expect(view.scopes?.root.kind).toBe('operator')
    expect(view.frames.get(document.root.id)?.box).toEqual([0, 0, 1000, 1000])
    expect(view.frames.get(document.root.children[0].id)?.box).toEqual([0, 0, 500, 1000])
    expect(view.source.complete).toBe(true)
    expect(view.drawing.parts).toHaveLength(2)
  })
  it('bakes an authored transform into the scoped pieces', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 10, 0] }]
    const view = documentView(document, drawing(parts), sketch(boxes))
    expect(view.scopes?.complete).toBe(true)
    const first = view.scopes?.root.kind === 'operator' ? view.scopes.root.children[0] : null
    expect(first?.kind === 'component' ? first.positive[0].d : '').toBe('M5 0L505 0L505 1000L5 1000Z')
  })
  it('keeps frames but has no scopes when the source is incomplete', () => {
    const document = fromSequence('木')
    const view = documentView(document, drawing([{ leaf: 0, d: square(100, 800) }]), null)
    expect(view.complete).toBe(false)
    expect(view.scopes).toBeNull()
    expect(view.frames.get(document.root.id)?.box).toEqual([0, 0, 1000, 1000])
    expect(view.issues.some(issue => issue.includes('no layout box'))).toBe(true)
  })
  it('renders a Möbius chain and marks its frame unsupported', () => {
    const document = fromSequence('木')
    document.root.transform = [{ type: 'mobius', a: [1, 0], b: [0, 0], c: [0.001, 0], d: [1, 0] }]
    const view = documentView(document, drawing([{ leaf: 0, d: square(100, 800) }]), sketch([[100, 100, 800, 800]]))
    expect(view.complete).toBe(true)
    expect(view.frames.get(document.root.id)?.supported).toBe(false)
  })
})

describe('scoped markup', () => {
  it('stays complete for an emoji part, which carries no path', () => {
    const document = fromSequence('⿰木口')
    const view = documentView(document, drawing([{ leaf: 0, d: '' }, { leaf: 1, d: square(500, 500) }]), sketch(boxes))
    expect(view.complete).toBe(true)
    expect(view.scopes?.complete).toBe(true)
    expect(view.issues).toEqual([])
  })
  it('writes emoji as text over the ink and masks the ink for cut ones', () => {
    const document = fromSequence('⿰木口')
    const view = documentView(document, drawing([{ leaf: 0, d: '' }, { leaf: 1, d: square(500, 500) }]), sketch(boxes))
    const ink = scopesMarkup(view.scopes, { emoji: [{ text: '🚗', box: boxes[0] }] })
    expect(ink.body).toContain('<text')
    expect(ink.body).toContain('🚗')
    expect(ink.body).not.toContain('ids-emoji')
    const cut = scopesMarkup(view.scopes, { emoji: [{ text: '🚗', box: boxes[0], cut: true }] })
    expect(cut.defs).toContain('<mask id="ids-emoji"')
    expect(cut.body).not.toContain('<text')
    expect(cut.defs).toContain('🚗')
  })
  it('leaves a restored emoji out of the mask', () => {
    const view = documentView(fromSequence('⿰木口'), drawing([{ leaf: 0, d: '' }, { leaf: 1, d: square(500, 500) }]), sketch(boxes))
    const markup = scopesMarkup(view.scopes, { emoji: [{ text: '🚗', box: boxes[0], cut: true }, { text: '🚗', box: boxes[1], restored: true }] })
    expect(markup.body).toContain('🚗')
    expect(markup.body).toMatch(/<\/g><text/)
  })
  it('masks the ink for the composer cut path too', () => {
    const view = documentView(fromSequence('⿰木口'), drawing(parts), sketch(boxes))
    const markup = scopesMarkup(view.scopes, { cut: square(200, 300) })
    expect(markup.defs).toContain('<path')
    expect(markup.body).toContain('mask="url(#ids-emoji)"')
  })
  it('escapes and places emoji text with its reflection', () => {
    const view = documentView(fromSequence('⿰木口'), drawing(parts), sketch(boxes))
    const markup = scopesMarkup(view.scopes, { emoji: [{ text: '&<🚗', box: boxes[0], flip: [false, true] }] })
    expect(markup.body).toContain('&amp;&lt;🚗')
    expect(markup.body).toContain('scale(1 -1)')
    expect(markup.body).toContain('x="250"')
    expect(markup.body).toContain('y="500"')
  })
  it('moves an emoji and the cut with the layer they stand for', () => {
    const document = fromSequence('㇯口🚗')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 100, 0] }]
    const view = documentView(document, { parts: [{ leaf: 0, d: square(0, 500), cut: true }, { leaf: 1, d: '' }], emoji: [{ text: '🚗', box: [500, 0, 500, 1000], leaf: 1 }] }, sketch(boxes))
    expect(view.scopes?.leafFrames.get(0)?.[4]).toBe(50)
    expect(view.scopes?.leafFrames.get(1)?.[4]).toBe(0)
    // The cut follows the moved 口, the emoji stays with its own untouched layer.
    const markup = scopesMarkup(view.scopes, { emoji: [{ text: '🚗', box: [500, 0, 500, 1000], leaf: 1 }], cut: square(0, 500), cutLeaf: 0 })
    expect(markup.defs).toContain('<path d="M0 0L500 0L500 1000L0 1000Z" fill="#000000" transform="matrix(1 0 0 1 50 0)"')
    expect(markup.body).toContain('>🚗</text>')
    const moved = scopesMarkup(view.scopes, { emoji: [{ text: '🚗', box: [0, 0, 500, 1000], leaf: 0 }] })
    expect(moved.body).toContain('transform="matrix(1 0 0 1 50 0)"')
    expect(scopesMarkup(view.scopes, { emoji: [{ text: '🚗', box: [0, 0, 500, 1000] }] }).body).not.toContain('matrix(')
  })
  it('returns defs and body without the svg wrapper', () => {
    const view = documentView(fromSequence('⿰木口'), drawing(parts), sketch(boxes))
    const markup = scopesMarkup(view.scopes, { idPrefix: 'preview' })
    expect(markup.width).toBe(1000)
    expect(markup.body).not.toContain('<svg')
    expect(markup.body).toContain('<path')
    expect(scopesSvg(view.scopes).startsWith('<svg ')).toBe(true)
  })
  it('keeps mask ids distinct by prefix', () => {
    const document = fromSequence('㇯木口')
    const view = documentView(document, drawing([{ leaf: 0, d: square(0, 1000) }, { leaf: 1, d: square(500, 500) }]), sketch(boxes))
    const one = scopesMarkup(view.scopes, { idPrefix: 'one' })
    const two = scopesMarkup(view.scopes, { idPrefix: 'two' })
    expect(one.defs).toContain('one-m1')
    expect(two.defs).toContain('two-m1')
  })
})
