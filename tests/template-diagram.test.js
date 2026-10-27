import { expect, test } from 'bun:test'
import { templateDiagram } from '../src/svelte/template-diagram.js'

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
    expect(shapes).toHaveLength(item.slots)
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
