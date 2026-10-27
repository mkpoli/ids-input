import { expect, test } from 'bun:test'
import { parse, reorderSiblings, write } from '../src/core/ids.js'

test('moving a sibling preserves the other parts and nested structure', () => {
  const tree = parse('⿲木⿱日月火', { open: true }).tree
  expect(write(reorderSiblings(tree, [0], [2]))).toBe('⿲⿱日月火木')
  expect(write(reorderSiblings(tree, [2], [0]))).toBe('⿲火木⿱日月')
  expect(write(reorderSiblings(tree, [1, 0], [1, 1]))).toBe('⿲木⿱月日火')
  expect(write(tree)).toBe('⿲木⿱日月火')
})
test('moving requires distinct existing siblings and can move empty slots', () => {
  const tree = parse('⿰木⬚', { open: true }).tree
  expect(write(reorderSiblings(tree, [0], [1]))).toBe('⿰⬚木')
  for (const [from, to] of [[[], [0]], [[0], [0]], [[0], [2]], [[0], [0, 1]], [[0, 0], [1, 0]], [[-1], [1]]]) {
    expect(reorderSiblings(tree, from, to)).toBe(tree)
  }
})

test('collapsed descendants follow their subtree when siblings move', async () => {
  const { remapSiblingPath } = await import('../src/svelte/sibling-drag.js')
  expect(remapSiblingPath([0, 1], [0], [2])).toEqual([2, 1])
  expect(remapSiblingPath([1, 0], [0], [2])).toEqual([0, 0])
  expect(remapSiblingPath([2, 0], [0], [2])).toEqual([1, 0])
  expect(remapSiblingPath([1, 0], [2], [0])).toEqual([2, 0])
  expect(remapSiblingPath([], [0], [2])).toEqual([])
})
