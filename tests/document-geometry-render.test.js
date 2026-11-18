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

describe('stroke width during an authored resize', () => {
  const affine = matrix => [{ type: 'affine', matrix }]
  const source = {
    geometry: () => ({ pieces: [{ d: 'M0 0L400 0L400 400L0 400ZM25 25L25 375L375 375L375 25Z' }] }),
    placement: () => [0.5, 0, 0, 1, 0, 0],
  }
  it('keeps the width of a horizontal stem under vertical scaling of a parent', () => {
    const document = {
      root: {
        kind: 'operator', op: '⿰', id: 'root',
        transform: affine([1, 0, 0, 2, 0, 0]),
        children: [{ kind: 'component', char: '口', id: 'a' }, { kind: 'slot', id: 'b' }],
      },
    }
    const sans = renderScopes(document, source, { stroke: [12.5, 25] })
    const other = renderScopes(document, source)
    expect(sans.complete).toBe(true)
    expect(sans.root.children[0].positive[0].d).toBe('M0.000 12.500L200.000 12.500L200.000 787.500L0.000 787.500ZM12.500 37.500L12.500 762.500L187.500 762.500L187.500 37.500Z')
    expect(other.root.children[0].positive[0].d).toBe('M0 0L200 0L200 800L0 800ZM12.5 50L12.5 750L187.5 750L187.5 50Z')
  })
  it('keeps a bar parallel to its rotated direction and preserves its width when shrunk', () => {
    const bar = { geometry: () => ({ pieces: [{ d: 'M0 0L300 0L300 20L0 20Z' }] }) }
    const document = { root: { kind: 'component', id: 'bar', transform: affine([0, 1, -0.5, 0, 0, 0]) } }
    const drawing = renderScopes(document, bar, { stroke: [20, 20] })
    expect(drawing.root.positive[0].d).toBe('M5.000 0.000L5.000 300.000L-15.000 300.000L-15.000 0.000Z')
  })
})
