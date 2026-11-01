import { expect, test } from 'bun:test'
import { templateDiagram } from '../src/svelte/template-diagram.js'
import { pyramidSequence } from '../src/core/pyramid.js'

test('pyramid diagrams turn with the direction, with equal square cells', () => {
  for (const direction of ['top', 'bottom', 'left', 'right']) for (const layers of [3, 4, 5, 6, 8, 24]) {
    const shapes = templateDiagram(pyramidSequence('口', layers, { direction }))
    expect(shapes).toHaveLength(layers * (layers + 1) / 2)
    const along = direction === 'left' || direction === 'right' ? 'x' : 'y'
    const groups = [...Map.groupBy(shapes, shape => shape[along])].sort((a, b) => a[0] - b[0]).map(([, group]) => group.length)
    const expected = direction === 'bottom' || direction === 'right'
      ? Array.from({ length: layers }, (_, i) => layers - i)
      : Array.from({ length: layers }, (_, i) => i + 1)
    expect(groups).toEqual(expected)
    for (const shape of shapes) {
      expect(shape.width).toBeCloseTo(shape.height)
      expect(shape.width).toBeGreaterThan(0)
    }
    const center = shape => [shape.x + shape.width / 2, shape.y + shape.height / 2]
    if (direction === 'top') {
      expect(center(shapes[0])[0]).toBeCloseTo(12)
      expect(center(shapes[0])[1]).toBeLessThan(center(shapes[1])[1])
    }
    if (direction === 'bottom') {
      const apex = center(shapes.at(-1))
      expect(apex[0]).toBeCloseTo(12)
      expect(apex[1]).toBeGreaterThan(center(shapes[0])[1])
    }
    if (direction === 'left') {
      const apex = center(shapes[0])
      expect(apex[0]).toBeLessThan(center(shapes.at(-1))[0])
      expect(apex[1]).toBeCloseTo(12)
    }
    if (direction === 'right') {
      const apex = center(shapes.at(-1))
      expect(apex[0]).toBeGreaterThan(center(shapes[0])[0])
      expect(apex[1]).toBeCloseTo(12)
    }
  }
})

test('nested enclosure diagrams retain the open host boundary', () => {
  const shapes = templateDiagram('⿰⬚⿸⬚⿱⬚⬚')
  expect(shapes.map(shape => shape.kind)).toEqual(['slot', 'frame', 'slot', 'slot'])
  const frame = shapes[1]
  expect(frame.d.match(/L/g)).toHaveLength(2)
  expect(shapes[2].x).toBeGreaterThan(shapes[0].x)
  expect(shapes[3].y).toBeGreaterThan(shapes[2].y)
})

test('overlay diagrams visibly distinguish their overlapping slots', () => {
  const [first, second] = templateDiagram('⿻⬚⬚')
  expect(first.kind).toBe('slot'); expect(second.kind).toBe('slot')
  expect(second.x).toBeGreaterThan(first.x)
  expect(second.y).toBeGreaterThan(first.y)
  expect(second.x).toBeLessThan(first.x + first.width)
  expect(second.y).toBeLessThan(first.y + first.height)
  expect(second.accent).toBe(true)
})

test('enclosure directions have distinct boundaries', () => {
  const paths = ['⿴','⿵','⿶','⿷','⿸','⿹','⿺','⿼','⿽'].map(op => templateDiagram(`${op}⬚⬚`)[0].d)
  expect(new Set(paths).size).toBe(9)
})

test('every catalog template has one visible shape per component', async () => {
  const { STRUCTURE_TEMPLATES } = await import('../src/core/templates.js')
  for (const item of STRUCTURE_TEMPLATES) {
    const shapes = templateDiagram(item.sequence)
    expect(shapes.filter(shape => !shape.decorative)).toHaveLength(item.slots)
    for (const shape of shapes) if (shape.kind === 'slot') {
      expect(shape.width).toBeGreaterThan(0)
      expect(shape.height).toBeGreaterThan(0)
      expect(shape.x).toBeGreaterThanOrEqual(2)
      expect(shape.y).toBeGreaterThanOrEqual(2)
      expect(shape.x + shape.width).toBeLessThanOrEqual(22)
      expect(shape.y + shape.height).toBeLessThanOrEqual(22)
    }
  }
})

test('mirrored layouts keep one slot and draw the axis they turn about', () => {
  const [left, right, axis] = templateDiagram('⿰⬚⿾⬚')
  expect([left.kind, right.kind, axis.kind]).toEqual(['slot', 'slot', 'frame'])
  expect(right.x).toBeGreaterThan(left.x)
  expect(axis.accent).toBe(true)
  expect(axis.decorative).toBe(true)
  expect(templateDiagram('⿿⬚')).toHaveLength(1)
})

test('Hangul template places the enclosure above its final slot', () => {
  const [frame, initial, final] = templateDiagram('⿱⿽⬚⬚⬚')
  expect(frame.kind).toBe('frame')
  expect(initial.kind).toBe('slot')
  expect(final.kind).toBe('slot')
  expect(initial.y + initial.height).toBeLessThan(final.y)
  expect(initial.x + initial.width).toBeLessThan(final.x + final.width)
})

test('only one reflected half gets the pair axis', () => {
  expect(templateDiagram('⿰⬚⿾⬚').filter(shape => shape.decorative)).toHaveLength(1)
  expect(templateDiagram('⿰⿾⬚⬚').filter(shape => shape.decorative)).toHaveLength(1)
  expect(templateDiagram('⿰⿾⬚⿾⬚').filter(shape => shape.decorative)).toHaveLength(2)
})
