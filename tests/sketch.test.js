import { describe, expect, it } from 'bun:test'
import { SIZE, chamfer, describe as shapeOf, distanceTransform, fitMask, fitStrokes, gradientDistance, gradientHistogram, rank, rasterize, shapesOf } from '../src/core/sketch.js'
import { sketchParts } from '../src/svelte/sketch-templates.js'

/** A closed rectangle, drawn as one stroke. */
const square = (x0 = 10, y0 = 10, x1 = 90, y1 = 90) => [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }]]
/** A horizontal and a vertical stroke crossing at the middle. */
const cross = () => [
  [{ x: 10, y: 50 }, { x: 90, y: 50 }],
  [{ x: 50, y: 10 }, { x: 50, y: 90 }],
]

const inkAt = (mask, x, y) => mask[y * SIZE + x]

describe('a drawing fitted to the square', () => {
  it('keeps its shape, centres it and leaves the margin', () => {
    const [stroke] = fitStrokes([[{ x: 0, y: 0 }, { x: 40, y: 20 }]], { stretch: false })
    expect(stroke.map(p => [Math.round(p.x), Math.round(p.y)])).toEqual([[2, 11], [38, 29]])
    const [small] = fitStrokes([[{ x: 0, y: 0 }, { x: 40, y: 20 }]], { factor: 0.5 })
    expect(Math.round(small[1].x - small[0].x)).toBe(18)
  })
  it('draws a rectangle as its four sides, not its inside', () => {
    const mask = rasterize(square())
    const column = [...Array(SIZE).keys()].filter(y => inkAt(mask, 20, y))
    const row = [...Array(SIZE).keys()].filter(x => inkAt(mask, x, 20))
    expect(column[0]).toBeLessThan(5)
    expect(column.at(-1)).toBeGreaterThan(SIZE - 5)
    expect(row[0]).toBeLessThan(5)
    expect(row.at(-1)).toBeGreaterThan(SIZE - 5)
    expect(inkAt(mask, 20, 20)).toBe(0)
  })
  it('does not stretch a wide or wavy line over the square', () => {
    const mask = rasterize([[{ x: 0, y: 40 }, { x: 50, y: 46 }, { x: 100, y: 40 }]])
    const rows = new Set()
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (inkAt(mask, x, y)) rows.add(y)
    expect(rows.size).toBeLessThan(12)
  })
})

describe('a glyph fitted to the square', () => {
  const alpha = (/** @type {number} */ size, /** @type {(x: number, y: number) => boolean} */ inside) => {
    const out = new Uint8Array(size * size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = inside(x, y) ? 255 : 0
    return out
  }
  it('finds the ink bounds and leaves a shape inside the square', () => {
    const mask = fitMask(alpha(64, (x, y) => x > 16 && x < 48 && y > 8 && y < 56), 64, 64)
    expect(mask).not.toBeNull()
    expect(inkAt(mask ?? new Uint8Array(SIZE * SIZE), 20, 20)).toBe(1)
    expect(inkAt(mask ?? new Uint8Array(SIZE * SIZE), 20, 39)).toBe(0)
  })
  it('does not stretch a thin glyph over the square', () => {
    const mask = fitMask(alpha(64, (x, y) => x > 6 && x < 58 && y > 30 && y < 35), 64, 64)
    const rows = new Set()
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (mask && inkAt(mask, x, y)) rows.add(y)
    expect(rows.size).toBeLessThan(14)
  })
  it('has nothing for an empty image', () => {
    expect(fitMask(new Uint8Array(64 * 64), 64, 64)).toBeNull()
  })
})

describe('the distance from ink', () => {
  it('is zero on the ink and one beside it', () => {
    const mask = rasterize([[{ x: 10, y: 50 }, { x: 90, y: 50 }]])
    const distance = distanceTransform(mask)
    let inked = -1
    for (let y = 0; y < SIZE; y++) if (inkAt(mask, 20, y)) { inked = y; break }
    expect(inked).toBeGreaterThanOrEqual(0)
    expect(distance[inked * SIZE + 20]).toBe(0)
    expect(distance[(inked + 6) * SIZE + 20]).toBeGreaterThan(0)
  })
})

describe('the palette parts a drawing may find', () => {
  it('takes single characters used as components often enough, and every stroke', () => {
    const parts = [
      { part: '木', uses: 3000, kind: 'c' },
      { part: '𰀁', uses: 5, kind: 'd' },
      { part: '⿰木木', uses: 3000, kind: 'c' },
      { part: '㇐', uses: 0, kind: 's' },
      { part: '水', kind: 'c' },
    ]
    expect(sketchParts(parts).map(part => part.part)).toEqual(['木', '㇐', '水'])
  })
})

describe('matching shapes', () => {
  const templates = [
    { name: 'square', shapes: [shapeOf(rasterize(square())), shapeOf(rasterize(square(), { stretch: false }))] },
    { name: 'cross', shapes: [shapeOf(rasterize(cross())), shapeOf(rasterize(cross(), { stretch: false }))] },
    { name: 'line', shapes: [shapeOf(rasterize([[{ x: 10, y: 50 }, { x: 90, y: 50 }]]))] },
  ]
  it('is closest to itself', () => {
    const shape = shapeOf(rasterize(square()))
    expect(chamfer(shape, shape)).toBe(0)
    expect(gradientDistance(shape.gradient, shape.gradient)).toBe(0)
  })
  it('orders the shapes a drawing looks like first', () => {
    expect(rank(shapesOf(square()), templates, { limit: 3 }).map(t => t.name)).toEqual(['square', 'cross', 'line'])
    expect(rank(shapesOf(cross()), templates, { limit: 3 }).map(t => t.name)).toEqual(['cross', 'line', 'square'])
  })
  it('tries a drawing a little smaller than the template', () => {
    const small = square(30, 30, 70, 70)
    expect(rank(shapesOf(small), templates, { limit: 1 })[0].name).toBe('square')
  })
  it('counts direction, not only ink', () => {
    const bar = shapeOf(rasterize([[{ x: 10, y: 50 }, { x: 90, y: 50 }]]))
    const post = shapeOf(rasterize([[{ x: 50, y: 10 }, { x: 50, y: 90 }]]))
    expect(chamfer(bar, post)).toBeGreaterThan(0)
    expect(gradientDistance(bar.gradient, post.gradient)).toBeGreaterThan(0)
    expect(gradientHistogram(bar.mask)).not.toEqual(gradientHistogram(post.mask))
  })
  it('puts parts with a stroke count near the drawing before the rest', () => {
    const shape = shapeOf(rasterize(square()))
    const both = [{ name: 'far', strokes: 8, shapes: [shape] }, { name: 'near', strokes: 4, shapes: [shape] }]
    expect(rank([shape], both, { strokes: 4, limit: 2 }).map(t => t.name)).toEqual(['near', 'far'])
  })
  it('allows two strokes of slack when the drawing has one or two', () => {
    const shape = shapeOf(rasterize(square()))
    const all = [{ name: 'one', strokes: 1, shapes: [shape] }, { name: 'three', strokes: 3, shapes: [shape] }, { name: 'five', strokes: 5, shapes: [shape] }]
    expect(rank([shape], all, { strokes: 1, limit: 3 }).map(t => t.name)).toEqual(['one', 'three', 'five'])
  })
  it('keeps a part two strokes away in the list', () => {
    const shape = shapeOf(rasterize(square()))
    const all = [{ name: 'four', strokes: 4, shapes: [shape] }, { name: 'six', strokes: 6, shapes: [shape] }, { name: 'two', strokes: 2, shapes: [shape] }]
    expect(rank([shape], all, { strokes: 4, limit: 3 }).map(t => t.name)).toEqual(['four', 'six', 'two'])
  })
  it('prefers the part more often used as a component', () => {
    const shape = shapeOf(rasterize(square()))
    const both = [{ name: 'rare', strokes: 4, uses: 2, shapes: [shape] }, { name: 'common', strokes: 4, uses: 900, shapes: [shape] }]
    expect(rank([shape], both, { strokes: 4, limit: 2 }).map(t => t.name)).toEqual(['common', 'rare'])
  })
  it('has nothing to rank without a shape or a template', () => {
    expect(rank([], templates)).toEqual([])
    expect(rank(shapesOf([]), templates)).toEqual([])
    expect(rank(shapesOf(square()), [])).toEqual([])
  })
})
