import { describe, expect, it } from 'bun:test'
import { fromSequence, renderLayers } from '../src/document/index.js'
import { compose, composeDocumentSource, createSource, documentSource, sketch as composerSketch } from '../src/composer/index.js'
import { files } from './fixtures/composer-export.js'

const square = (x, width) => `M${x} 0L${x + width} 0L${x + width} 1000L${x} 1000Z`
const sketch = (boxes) => boxes.map((box, index) => ({ index, box, empty: false }))
const drawing = parts => ({ parts })

const sourceOf = (sequence, boxes, parts) => {
  const document = fromSequence(sequence)
  const made = documentSource(document, drawing(parts), sketch(boxes))
  return { document, ...made }
}

describe('a composer-backed document source', () => {
  it('turns leaf boxes into placements and local geometry', () => {
    const { document, source, complete } = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { leaf: 0, d: square(0, 500) },
      { leaf: 1, d: square(500, 500) },
    ])
    expect(complete).toBe(true)
    const [wood, mouth] = document.root.children
    expect(source.placement(document.root, wood, 0)).toEqual([0.5, 0, 0, 1, 0, 0])
    expect(source.placement(document.root, mouth, 1)).toEqual([0.5, 0, 0, 1, 500, 0])
    expect(source.geometry(wood)?.pieces[0].d).toBe(square(0, 1000))
    expect(source.geometry(mouth)?.pieces[0].d).toBe(square(0, 1000))
  })
  it('reconstructs the composer drawing with identity transforms', () => {
    const { document, source } = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { leaf: 0, d: square(0, 500) },
      { leaf: 1, d: square(500, 500) },
    ])
    const rendered = renderLayers(document, source)
    expect(rendered.complete).toBe(true)
    expect(rendered.pieces[0].d).toBe(square(0, 500))
    expect(rendered.pieces[1].d).toBe(square(500, 500))
  })
  it('applies a child transform in its local frame', () => {
    const { document, source } = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { leaf: 0, d: square(0, 500) },
      { leaf: 1, d: square(500, 500) },
    ])
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 10, 0] }]
    const rendered = renderLayers(document, source)
    expect(rendered.pieces[0].d).toBe('M5 0L505 0L505 1000L5 1000Z')
  })
  it('keeps a group frame around its child', () => {
    const document = fromSequence('木')
    const child = document.root
    document.root = { id: 'group', kind: 'group', child }
    const made = documentSource(document, drawing([{ leaf: 0, d: square(100, 800) }]), sketch([[100, 100, 800, 800]]))
    expect(made.complete).toBe(true)
    expect(renderLayers(document, made.source).pieces[0].d).toBe(square(100, 800))
  })
  it('leaves a root component in the canvas frame', () => {
    const document = fromSequence('木')
    const made = documentSource(document, drawing([{ leaf: 0, d: square(100, 800) }]), sketch([[100, 100, 800, 800]]))
    expect(made.complete).toBe(true)
    expect(made.source.geometry(document.root)?.pieces[0].d).toBe(square(100, 800))
    expect(renderLayers(document, made.source).pieces[0].d).toBe(square(100, 800))
  })
  it('infers leaf ownership when a separated drawing has one part per component', () => {
    const { document, source, complete } = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { d: square(0, 500) },
      { d: square(500, 500) },
    ])
    expect(complete).toBe(true)
    expect(source.geometry(document.root.children[0])?.pieces[0].d).toBe(square(0, 1000))
    expect(source.geometry(document.root.children[1])?.pieces[0].d).toBe(square(0, 1000))
  })
  it('reports parts it cannot attribute, invalid indices and missing sketches', () => {
    const short = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [{ d: square(0, 500) }])
    expect(short.complete).toBe(false)
    expect(short.issues.some(issue => issue.startsWith('leaf 1 has no drawn part'))).toBe(true)

    const cut = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { d: square(0, 500), cut: true },
      { d: square(500, 500) },
    ])
    expect(cut.complete).toBe(false)

    const badIndex = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { leaf: -1, d: square(0, 500) },
      { leaf: 1, d: square(500, 500) },
    ])
    expect(badIndex.complete).toBe(false)
    expect(badIndex.issues).toContain('a drawn part has no valid leaf index')

    const slot = sourceOf('⿰木⬚', [[0, 0, 500, 1000], [500, 0, 500, 1000]], [
      { leaf: 0, d: square(0, 500) },
      { leaf: 1, d: square(0, 1000) },
    ])
    expect(slot.complete).toBe(false)
    expect(slot.issues).toContain('part leaf 1 belongs to an empty slot')

    const document = fromSequence('木')
    const noSketch = documentSource(document, drawing([{ leaf: 0, d: square(100, 800) }]), null)
    expect(noSketch.complete).toBe(false)
    expect(noSketch.source.geometry(document.root)?.pieces[0].d).toBe(square(100, 800))
  })
  it('rejects path data the transform engine cannot read', () => {
    const made = sourceOf('木', [[0, 0, 1000, 1000]], [{ leaf: 0, d: 'M0 0H100' }])
    expect(made.complete).toBe(false)
    expect(made.issues).toContain('part leaf 0 has path data the transform engine cannot read')
  })
  it('draws a document through a preview and forwards its sketch', async () => {
    const document = fromSequence('⿰木口')
    const boxes = [[0, 0, 500, 1000], [500, 0, 500, 1000]]
    const parts = [{ leaf: 0, d: square(0, 500) }, { leaf: 1, d: square(500, 500) }]
    let heard = null
    const preview = async (sequence, { onSketch } = {}) => {
      expect(sequence).toBe('⿰木口')
      onSketch?.(sketch(boxes))
      return drawing(parts)
    }
    const made = await composeDocumentSource(document, preview, { onSketch: leaves => { heard = leaves } })
    expect(made.complete).toBe(true)
    expect(made.drawing.parts).toHaveLength(2)
    expect(heard).toHaveLength(2)
    expect(renderLayers(document, made.source).complete).toBe(true)
  })
  it('uses an actual separated composer drawing without leaf labels', async () => {
    const source = createSource(async name => {
      const body = files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const document = fromSequence('⿰木口')
    const drawing = await compose(source, '⿰木口', { separate: true })
    const made = documentSource(document, drawing, await composerSketch(source, '⿰木口'))
    expect(made.complete).toBe(true)
    const rendered = renderLayers(document, made.source)
    expect(rendered.complete).toBe(true)
    expect(rendered.pieces).toHaveLength(2)
    expect(rendered.pieces.every(piece => piece.d.length > 0)).toBe(true)
  })
  it('keeps cut pieces and rejects a zero box', () => {
    const { document, source } = sourceOf('⿰木口', [[0, 0, 500, 1000], [500, 0, 0, 1000]], [
      { leaf: 0, d: square(0, 500), cut: true },
      { leaf: 1, d: square(500, 500) },
    ])
    expect(source.geometry(document.root.children[0])?.pieces[0].cut).toBe(true)
    expect(source.geometry(document.root.children[1])).toBeNull()
  })
})
