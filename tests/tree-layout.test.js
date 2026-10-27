import { describe, expect, test } from 'bun:test'
import { parse } from '../src/core/ids.js'
import { treeSizes } from '../src/svelte/tree-layout.js'

describe('tree space allocation', () => {
  test('biang reserves room for its dense middle group', () => {
    const tree = parse('⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心').tree
    const sizes = treeSizes(tree)
    const column = tree.parts[1]
    const middle = column.parts[1]
    expect(sizes.get(middle).height).toBeGreaterThan(2 * sizes.get(column.parts[0]).height)
    expect(sizes.get(middle.parts[1]).width).toBeGreaterThan(3 * sizes.get(middle.parts[0]).width)
  })

  test('allocation follows the split axis rather than the number of leaves', () => {
    const row = parse('⿰木⿳口口口').tree
    const sizes = treeSizes(row)
    expect(sizes.get(row.parts[1]).width / sizes.get(row.parts[0]).width).toBeLessThan(2)
    expect(sizes.get(row.parts[1]).height / sizes.get(row.parts[0]).height).toBeGreaterThan(3)
    const equal = parse('⿲木口日').tree
    const equalSizes = treeSizes(equal)
    expect(equal.parts.map(part => equalSizes.get(part))).toEqual(Array(3).fill({ width: 1, height: 1 }))
  })
})
