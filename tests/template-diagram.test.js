import { expect, test } from 'bun:test'
import { templateDiagram } from '../src/svelte/template-diagram.js'
import { pyramidSequence } from '../src/core/pyramid.js'

test('pyramid diagrams follow row direction with equal square cells', () => {
  for (const reverse of [false, true]) for (const layers of [3, 4, 5, 6, 8, 24]) {
    const shapes = templateDiagram(pyramidSequence('口', layers, { reverse }))
    const rows = Map.groupBy(shapes, shape => shape.y)
    expect([...rows.values()].map(row => row.length)).toEqual(
      Array.from({ length: layers }, (_, i) => reverse ? layers - i : i + 1))
    for (const shape of shapes) {
      expect(shape.width).toBeCloseTo(shape.height)
      expect(shape.width).toBeGreaterThan(0)
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
