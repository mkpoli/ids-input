import { describe, expect, it } from 'bun:test'
import { boxCorners, fromSequence, invertAffine, layerAtPath, layerFrames, pathOfLayer } from '../src/document/index.js'
import { documentSource } from '../src/composer/index.js'

const identity = [1, 0, 0, 1, 0, 0]
const sketch = boxes => boxes.map((box, index) => ({ index, box, empty: false }))
const sourceFor = (document, boxes) => documentSource(document, { parts: [] }, sketch(boxes)).source
const manual = placement => ({ geometry: () => ({ pieces: [] }), placement: (parent, child, index) => placement(parent, child, index) })

describe('layer paths', () => {
  it('maps editor paths through operators and groups', () => {
    const document = fromSequence('⿰木口')
    const [wood, mouth] = document.root.children
    expect(layerAtPath(document.root, [0])?.id).toBe(wood.id)
    expect(layerAtPath(document.root, [1])?.id).toBe(mouth.id)
    expect(pathOfLayer(document.root, wood.id)).toEqual([0])
    document.root = { id: 'group', kind: 'group', child: document.root }
    expect(layerAtPath(document.root, [0])?.id).toBe(wood.id)
    expect(pathOfLayer(document.root, 'group')).toEqual([])
  })
  it('returns null for an impossible path or missing id', () => {
    const document = fromSequence('木')
    expect(layerAtPath(document.root, [0])).toBeNull()
    expect(pathOfLayer(document.root, 'missing')).toBeNull()
  })
})

describe('layer frames', () => {
  it('uses the canvas for the root and sketch boxes for leaves', () => {
    const document = fromSequence('⿰木口')
    const frames = layerFrames(document, sourceFor(document, [[0, 0, 500, 1000], [500, 0, 500, 1000]]), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    expect(frames.get(document.root.id)).toMatchObject({ box: [0, 0, 1000, 1000], depth: 0, canvas: identity, place: identity, full: identity, supported: true })
    expect(frames.get(document.root.children[0].id)?.box).toEqual([0, 0, 500, 1000])
    expect(frames.get(document.root.children[0].id)?.depth).toBe(1)
    expect(frames.get(document.root.children[0].id)?.canvas).toEqual(identity)
    expect(frames.get(document.root.children[0].id)?.place).toEqual([0.5, 0, 0, 1, 0, 0])
    expect(frames.get(document.root.children[0].id)?.full).toEqual([0.5, 0, 0, 1, 0, 0])
  })
  it('keeps a leaf transform in its local frame and maps its box by the same ratio', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 10, 0] }]
    const frames = layerFrames(document, sourceFor(document, [[0, 0, 500, 1000], [500, 0, 500, 1000]]), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    // Ten local units in a half-width placement are five canvas units.
    expect(frames.get(document.root.children[0].id)?.canvas).toEqual([1, 0, 0, 1, 5, 0])
    expect(frames.get(document.root.children[0].id)?.full).toEqual([0.5, 0, 0, 1, 5, 0])
    expect(boxCorners([1, 0, 0, 1, 5, 0], [0, 0, 500, 1000])).toEqual([5, 0, 500, 1000])
  })
  it('carries an ancestor transform down to a nested layer', () => {
    const document = fromSequence('⿰⿱木口木')
    const parent = document.root.children[0]
    parent.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 100, 0] }]
    const boxes = [[0, 0, 500, 500], [0, 500, 500, 500], [500, 0, 500, 1000]]
    const frames = layerFrames(document, sourceFor(document, boxes), sketch(boxes))
    const top = parent.children[0]
    const frame = frames.get(top.id)
    expect(frame?.place).toEqual([0.5, 0, 0, 0.5, 50, 0])
    expect(frame?.full).toEqual([0.5, 0, 0, 0.5, 50, 0])
    expect(frame?.canvas).toEqual([1, 0, 0, 1, 50, 0])
    expect(boxCorners(frame?.canvas ?? identity, frame?.box ?? [0, 0, 0, 0])).toEqual([50, 0, 500, 500])
  })
  it('marks a nonlinear chain as unsupported', () => {
    const document = fromSequence('木')
    document.root.transform = [{ type: 'mobius', a: [1, 0], b: [0, 0], c: [0.001, 0], d: [1, 0] }]
    const frames = layerFrames(document, sourceFor(document, [[0, 0, 1000, 1000]]), sketch([[0, 0, 1000, 1000]]))
    expect(frames.get(document.root.id)?.supported).toBe(false)
  })
  it('marks a singular transform as unsupported', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [0, 0, 0, 1, 0, 0] }]
    const frames = layerFrames(document, sourceFor(document, [[0, 0, 500, 1000], [500, 0, 500, 1000]]), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    expect(frames.get(document.root.children[0].id)?.supported).toBe(false)
    expect(frames.get(document.root.children[1].id)?.supported).toBe(true)
  })
  it('omits a child with no placement', () => {
    const document = fromSequence('⿰木口')
    const frames = layerFrames(document, manual(() => null), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    expect(frames.size).toBe(1)
    expect(frames.has(document.root.children[0].id)).toBe(false)
  })
  it('inverts an affine matrix and refuses a singular one', () => {
    expect(invertAffine([1, 0, 0, 1, 10, 20])).toEqual([1, 0, 0, 1, -10, -20])
    expect(invertAffine([0, 0, 0, 0, 0, 0])).toBeNull()
  })
})
