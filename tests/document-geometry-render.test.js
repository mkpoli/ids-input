import { describe, expect, it } from 'bun:test'
import { renderLayers, renderScopes } from '../src/document/render.js'
import { fingerprintGeometry } from '../src/document/geometry-edit.js'

const translate = (x, y) => [{ type: 'affine', matrix: [1, 0, 0, 1, x, y] }]

describe('rendering geometry edits', () => {
  it('applies a stroke edit before the layer transforms', () => {
    const geometry = { pieces: [{ d: 'M0 0L10 0Z' }], strokes: [{ id: 's1', pieces: [0] }] }
    const document = {
      root: { kind: 'component', id: 'n1' },
      geometryEdits: [{ id: 'e1', node: 'n1', geometry: fingerprintGeometry(geometry), target: { kind: 'stroke', id: 's1' }, transform: translate(5, 0) }],
    }
    const source = { geometry: () => geometry, placement: () => null }
    const drawing = renderLayers(document, source)
    expect(drawing.complete).toBe(true)
    expect(drawing.pieces[0].d).toContain('M5 0')
  })

  it('reports an edit whose stroke group the component lacks', () => {
    const geometry = { pieces: [{ d: 'M0 0L10 0Z' }], strokes: [] }
    const document = {
      root: { kind: 'component', id: 'n1' },
      geometryEdits: [{ id: 'e1', node: 'n1', geometry: fingerprintGeometry(geometry), target: { kind: 'stroke', id: 'missing' }, transform: translate(5, 0) }],
    }
    const source = { geometry: () => geometry, placement: () => null }
    const drawing = renderLayers(document, source)
    expect(drawing.complete).toBe(false)
    expect(drawing.issues[0].message).toContain('unresolved geometry edit e1')
  })
})

describe('geometry edit resolution', () => {
  it('reports an edit whose layer is gone', () => {
    const document = {
      root: { kind: 'component', id: 'n1' },
      geometryEdits: [{ id: 'e1', node: 'gone', geometry: 'a'.repeat(64), target: { kind: 'stroke', id: 's' }, transform: translate(5, 0) }],
    }
    const source = { geometry: () => ({ pieces: [{ d: 'M0 0L10 0Z' }], strokes: [{ id: 's', pieces: [0] }] }), placement: () => null }
    const drawing = renderLayers(document, source)
    expect(drawing.complete).toBe(false)
    expect(drawing.issues.some(issue => issue.message.includes('no layer gone'))).toBe(true)
  })

  it('says a layer that is not a component cannot take a geometry edit', () => {
    const document = {
      root: { kind: 'operator', id: 'op', op: '⿰', children: [{ kind: 'component', id: 'n1' }, { kind: 'slot', id: 'n2' }] },
      geometryEdits: [{ id: 'e1', node: 'op', geometry: 'a'.repeat(64), target: { kind: 'stroke', id: 's' }, transform: translate(5, 0) }],
    }
    const source = { geometry: () => ({ pieces: [{ d: 'M0 0L10 0Z' }] }), placement: () => [1, 0, 0, 1, 0, 0] }
    for (const draw of [renderLayers, renderScopes]) {
      const messages = draw(document, source).issues.map(issue => issue.message)
      expect(messages.some(message => message.includes('no layer'))).toBe(false)
      expect(messages.some(message => message.includes('op, which is not a component'))).toBe(true)
    }
  })
})
