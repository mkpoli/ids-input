import { describe, expect, it } from 'bun:test'
import { fromSequence, renderScopes, scopesSvg } from '../src/document/index.js'

const identity = [1, 0, 0, 1, 0, 0]
const square = (d = 'M0 0L10 0L10 10L0 10Z', cut = false) => ({ d, fillRule: cut ? 'evenodd' : 'nonzero', cut })
const source = pieces => ({
  geometry: () => ({ pieces }),
  placement: () => identity,
})

describe('scoped drawings', () => {
  it('separates positive and cut pieces by component', () => {
    const document = fromSequence('⿰木口')
    const cutSource = {
      geometry: node => node.char === '木' ? { pieces: [square(), square('M2 2L8 2L8 8L2 8Z', true)] } : { pieces: [square()] },
      placement: () => identity,
    }
    const drawing = renderScopes(document, cutSource)
    expect(drawing.complete).toBe(true)
    expect(drawing.root.kind).toBe('operator')
    expect(drawing.root.children[0]).toMatchObject({ kind: 'component', node: document.root.children[0].id })
    expect(drawing.root.children[0].positive).toHaveLength(1)
    expect(drawing.root.children[0].negative).toHaveLength(1)
    expect(drawing.root.children[1].positive).toHaveLength(1)
    expect(drawing.root.children[1].negative).toHaveLength(0)
  })
  it('keeps operator nesting and empty slots in place', () => {
    const document = fromSequence('⿻㇯木口口')
    const drawing = renderScopes(document, source([square()]))
    expect(drawing.complete).toBe(true)
    expect(drawing.root).toMatchObject({ kind: 'operator', op: '⿻' })
    expect(drawing.root.children[0]).toMatchObject({ kind: 'operator', op: '㇯' })
    expect(drawing.root.children[0].children).toHaveLength(2)
    const slot = fromSequence('⿰木')
    expect(renderScopes(slot, source([square()])).root.children).toHaveLength(2)
    expect(renderScopes(slot, source([square()])).root.children[1]).toMatchObject({ kind: 'slot' })
  })
  it('reports an incomplete tree when geometry or placement is missing', () => {
    const document = fromSequence('⿰木口')
    const noGeometry = renderScopes(document, { geometry: () => null, placement: () => identity })
    expect(noGeometry).toMatchObject({ root: { kind: 'operator', children: [{ kind: 'slot' }, { kind: 'slot' }] }, complete: false })
    const noPlacement = renderScopes(document, { geometry: () => ({ pieces: [square()] }), placement: () => null })
    expect(noPlacement.complete).toBe(false)
    expect(noPlacement.root.children).toHaveLength(2)
  })
})

describe('compositing SVG', () => {
  const document = fromSequence('⿰木口')
  it('draws uncut components as paths', () => {
    const svg = scopesSvg(renderScopes(document, source([square()])))
    expect(svg).toStartWith('<svg ')
    expect(svg).toContain('viewBox="0 0 1000 1000"')
    expect(svg).toContain('<path d="M0 0L10 0L10 10L0 10Z" fill="#000000" fill-rule="nonzero"/>')
    expect(svg).not.toContain('<mask')
  })
  it('scopes cuts to their component with a mask', () => {
    const svg = scopesSvg(renderScopes(document, source([square(), square('M2 2L8 2L8 8L2 8Z', true)])))
    expect(svg).toContain('<mask id="ids-m1"')
    expect(svg).toContain('fill="#000000" mask="url(#ids-m1)"')
    expect(svg).toContain('fill-rule="evenodd"')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="#000000"')
  })
  it('subtracts the second operand of ㇯ with an inverse mask', () => {
    const svg = scopesSvg(renderScopes(fromSequence('㇯木口'), source([square()])))
    expect(svg).toContain('<mask id="ids-m1"')
    expect(svg).toContain('<g mask="url(#ids-m1)"')
    expect(svg).toContain('<rect width="1000" height="1000" fill="#ffffff"/><path')
    expect(svg).toContain('fill="#000000"')
  })
  it('treats an empty ㇯ operand as empty', () => {
    const second = scopesSvg(renderScopes(fromSequence('㇯木'), source([square()])))
    expect(second).toContain('<path')
    expect(second).not.toContain('<mask')
    const first = scopesSvg(renderScopes(fromSequence('㇯⬚口'), source([square()])))
    expect(first).not.toContain('<path')
  })
  it('keeps nested ㇯ compounding scoped masks', () => {
    const svg = scopesSvg(renderScopes(fromSequence('㇯㇯木口口'), source([square()])))
    expect(svg.match(/<mask/g)?.length).toBeGreaterThanOrEqual(2)
    expect(svg).toContain('<g mask="url(#ids-m')
  })
  it('writes an empty drawing for an empty root', () => {
    const svg = scopesSvg(renderScopes(fromSequence('⬚'), source([square()])))
    expect(svg).not.toContain('<path')
    expect(svg).toContain('viewBox="0 0 1000 1000"')
  })
  it('writes currentColor ink and a padded viewBox', () => {
    const svg = scopesSvg(renderScopes(fromSequence('木'), source([square()])), { ink: 'currentColor', padding: 0.05 })
    expect(svg).toContain('viewBox="-50 -50 1100 1100"')
    expect(svg).toContain('fill="currentColor"')
  })
  it('draws optional empty-slot boxes with a dashed outline', () => {
    const svg = scopesSvg(renderScopes(fromSequence('⬚'), source([square()])), { slots: [[100, 100, 300, 500]] })
    expect(svg).toContain('stroke-dasharray="12 8"')
    expect(svg).toContain('x="100" y="100" width="300" height="500"')
  })
  it('accepts a background, ink colour and size, and rejects unsafe values', () => {
    const svg = scopesSvg(renderScopes(fromSequence('木'), source([square()])), { background: '#fafafa', ink: '#123456', size: 640, idPrefix: 'x' })
    expect(svg).toContain('width="640" height="640"')
    expect(svg).toContain('fill="#fafafa"')
    expect(svg).toContain('fill="#123456"')
    const unsafe = scopesSvg(renderScopes(fromSequence('木'), source([square()])), { ink: 'red" onload="x' })
    expect(unsafe).toContain('fill="#000000"')
    expect(unsafe).not.toContain('onload')
    const injected = scopesSvg({ root: { kind: 'component', node: 'x', positive: [{ d: 'M0 0L1 1"><script>', cut: false }], negative: [] }, complete: true, issues: [] })
    expect(injected).not.toContain('<script>')
  })
})
