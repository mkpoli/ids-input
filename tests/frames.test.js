import { describe, expect, it } from 'bun:test'
import { boxCorners, fromSequence, invertAffine, layerAtPath, layerFrames, pathOfLayer } from '../src/document/index.js'

const identity = [1, 0, 0, 1, 0, 0]
const source = (placement = () => identity) => ({ geometry: () => ({ pieces: [] }), placement: (parent, child, index) => placement(parent, child, index) })
const sketch = boxes => boxes.map((box, index) => ({ index, box, empty: false }))

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
    const frames = layerFrames(document, source(), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    expect(frames.get(document.root.id)).toMatchObject({ box: [0, 0, 1000, 1000], canvas: identity, supported: true })
    expect(frames.get(document.root.children[0].id)?.box).toEqual([0, 0, 500, 1000])
    expect(frames.get(document.root.children[0].id)?.canvas).toEqual(identity)
  })
  it('keeps a leaf transform in its canvas frame', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 10, 0] }]
    const frames = layerFrames(document, source(), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    expect(frames.get(document.root.children[0].id)?.canvas).toEqual([1, 0, 0, 1, 10, 0])
    expect(boxCorners([1, 0, 0, 1, 10, 0], [0, 0, 500, 1000])).toEqual([10, 0, 500, 1000])
  })
  it('marks a nonlinear chain as unsupported', () => {
    const document = fromSequence('木')
    document.root.transform = [{ type: 'mobius', a: [1, 0], b: [0, 0], c: [0.001, 0], d: [1, 0] }]
    const frames = layerFrames(document, source(), sketch([[0, 0, 1000, 1000]]))
    expect(frames.get(document.root.id)?.supported).toBe(false)
  })
  it('omits a child with no placement', () => {
    const document = fromSequence('⿰木口')
    const frames = layerFrames(document, source(() => null), sketch([[0, 0, 500, 1000], [500, 0, 500, 1000]]))
    expect(frames.size).toBe(1)
    expect(frames.has(document.root.children[0].id)).toBe(false)
  })
  it('inverts an affine matrix and refuses a singular one', () => {
    expect(invertAffine([1, 0, 0, 1, 10, 20])).toEqual([1, 0, 0, 1, -10, -20])
    expect(invertAffine([0, 0, 0, 0, 0, 0])).toBeNull()
  })
})
