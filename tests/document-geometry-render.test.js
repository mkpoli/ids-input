import { describe, expect, it } from 'bun:test'
import { renderLayers } from '../src/document/render.js'

const translate = (x, y) => [{ type: 'affine', matrix: [1, 0, 0, 1, x, y] }]

describe('rendering geometry edits', () => {
  it('applies a stroke edit before the layer transforms', () => {
    const document = {
      root: { kind: 'component', id: 'n1' },
      geometryEdits: [{ id: 'e1', node: 'n1', geometry: 'a'.repeat(64), target: { kind: 'stroke', id: 's1' }, transform: translate(5, 0) }],
    }
    const source = {
      geometry: () => ({ pieces: [{ d: 'M0 0L10 0Z' }], strokes: [{ id: 's1', pieces: [0] }] }),
      placement: () => null,
    }
    const drawing = renderLayers(document, source)
    expect(drawing.complete).toBe(true)
    expect(drawing.pieces[0].d).toContain('M5 0')
  })

  it('reports an edit whose stroke group the component lacks', () => {
    const document = {
      root: { kind: 'component', id: 'n1' },
      geometryEdits: [{ id: 'e1', node: 'n1', geometry: 'a'.repeat(64), target: { kind: 'stroke', id: 'missing' }, transform: translate(5, 0) }],
    }
    const source = { geometry: () => ({ pieces: [{ d: 'M0 0L10 0Z' }], strokes: [] }), placement: () => null }
    const drawing = renderLayers(document, source)
    expect(drawing.complete).toBe(false)
    expect(drawing.issues[0].message).toContain('unresolved geometry edit e1')
  })
})
