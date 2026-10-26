import { describe, expect, it } from 'bun:test'
import { fromSequence, renderLayers } from '../src/document/index.js'

const identity = [1, 0, 0, 1, 0, 0]
const square = { pieces: [{ d: 'M0 0L10 0L10 10L0 10Z', fillRule: 'nonzero', cut: false }] }
const source = (placement = () => identity) => ({
  geometry: () => square,
  placement: (parent, child, index) => placement(parent, child, index),
})

describe('layer rendering', () => {
  it('composes child transforms, placements and parent transforms in order', () => {
    const document = fromSequence('⿰木口')
    document.root.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 10, 20] }]
    document.root.children[0].transform = [{ type: 'affine', matrix: [2, 0, 0, 2, 0, 0] }]
    const drawing = renderLayers(document, source())
    expect(drawing.complete).toBe(true)
    expect(drawing.pieces.map(piece => piece.node)).toEqual([document.root.children[0].id, document.root.children[1].id])
    expect(drawing.pieces[0].d).toBe('M10 20L30 20L30 40L10 40Z')
    expect(drawing.pieces[1].d).toBe('M10 20L20 20L20 30L10 30Z')
    expect(drawing.pieces[0].approximate).toBe(false)
  })
  it('uses a placement in the parent frame', () => {
    const document = fromSequence('⿰木口')
    const drawing = renderLayers(document, source((parent, child, index) => [1, 0, 0, 1, index * 100, 0]))
    expect(drawing.pieces[0].d).toBe('M0 0L10 0L10 10L0 10Z')
    expect(drawing.pieces[1].d).toBe('M100 0L110 0L110 10L100 10Z')
  })
  it('applies a group transform after its child transform', () => {
    const document = fromSequence('木')
    const child = document.root
    document.root = { id: 'group', kind: 'group', child }
    document.root.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 5, 5] }]
    child.transform = [{ type: 'affine', matrix: [2, 0, 0, 2, 0, 0] }]
    const drawing = renderLayers(document, source())
    expect(drawing.pieces[0].d).toBe('M5 5L25 5L25 25L5 25Z')
  })
  it('reports missing geometry, missing placement and unsupported transforms', () => {
    const document = fromSequence('⿰木口')
    const missingGeometry = renderLayers(document, { geometry: () => null, placement: () => identity })
    expect(missingGeometry.complete).toBe(false)
    expect(missingGeometry.issues.every(issue => issue.reason === 'geometry')).toBe(true)

    const missingPlacement = renderLayers(document, { geometry: () => square, placement: () => null })
    expect(missingPlacement.complete).toBe(false)
    expect(missingPlacement.issues[0].reason).toBe('placement')

    const throwingPlacement = renderLayers(document, { geometry: () => square, placement: () => { throw new Error('layout missing') } })
    expect(throwingPlacement.complete).toBe(false)
    expect(throwingPlacement.issues[0].message).toBe('layout missing')

    const throwing = renderLayers(document, { geometry: () => { throw new Error('glyph missing') }, placement: () => identity })
    expect(throwing.complete).toBe(false)
    expect(throwing.issues[0].message).toBe('glyph missing')

    document.root.transform = [{ type: 'example.org/warp' }]
    const unknown = renderLayers(document, source())
    expect(unknown.complete).toBe(false)
    expect(unknown.issues[0].reason).toBe('transform')
  })
  it('marks a nonlinear child piece as approximate and keeps its cut role', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'mobius', a: [1, 0], b: [0, 0], c: [0.001, 0], d: [1, 0] }]
    const geometry = { pieces: [{ d: 'M1 1L2 1L2 2L1 2Z', fillRule: 'evenodd', cut: true }] }
    const drawing = renderLayers(document, { geometry: () => geometry, placement: () => identity })
    expect(drawing.complete).toBe(true)
    expect(drawing.pieces[0].approximate).toBe(true)
    expect(drawing.pieces[0].cut).toBe(true)
    expect(drawing.pieces[0].fillRule).toBe('evenodd')
  })
})
