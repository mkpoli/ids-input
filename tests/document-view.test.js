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
