import { describe, expect, it } from 'bun:test'
import { applyGeometryEdits, splitSubpaths } from '../src/document/geometry-edit.js'

const translate = (x, y) => [{ type: 'affine', matrix: [1, 0, 0, 1, x, y] }]
const edit = (id, target, x = 5, y = 0) => ({ id, node: 'n1', geometry: 'a'.repeat(64), target, transform: translate(x, y) })

describe('geometry edits', () => {
  it('splits and rejoins a compound piece', () => {
    expect(splitSubpaths('M0 0L10 0Z M20 0L30 0Z')).toHaveLength(2)
  })

  it('moves one contour inside its own piece', () => {
    const geometry = { pieces: [{ d: 'M0 0L10 0L10 10L0 10Z M20 0L30 0L30 10L20 10Z', fillRule: 'nonzero' }] }
    const out = applyGeometryEdits(geometry, [edit('e1', { kind: 'contour', piece: 0, contour: 1 }, 5, 0)], 'n1')
    expect(out.applied).toEqual(['e1'])
    expect(out.unresolved).toEqual([])
    expect(out.geometry.pieces[0].d).toContain('25 0')
    expect(out.geometry.pieces[0].fillRule).toBe('nonzero')
  })

  it('moves every piece in a stroke group and leaves the others alone', () => {
    const geometry = {
      pieces: [{ d: 'M0 0L10 0Z' }, { d: 'M20 0L30 0Z' }, { d: 'M40 0L50 0Z' }],
      strokes: [{ id: 's1', pieces: [0, 1] }],
    }
    const out = applyGeometryEdits(geometry, [edit('e1', { kind: 'stroke', id: 's1' }, 5, 0)], 'n1')
    expect(out.geometry.pieces[0].d).toContain('5 0')
    expect(out.geometry.pieces[1].d).toContain('25 0')
    expect(out.geometry.pieces[2].d).toContain('40 0')
  })

  it('keeps an edit whose target is absent unresolved', () => {
    const geometry = { pieces: [{ d: 'M0 0L10 0Z' }], strokes: [] }
    const out = applyGeometryEdits(geometry, [edit('e1', { kind: 'stroke', id: 'missing' })], 'n1')
    expect(out.applied).toEqual([])
    expect(out.unresolved.map(item => item.id)).toEqual(['e1'])
    expect(out.geometry.pieces[0].d).toBe('M0 0L10 0Z')
  })
})
