import { expect, test } from 'bun:test'
import { parse, swapParts, write } from '../src/core/ids.js'

test('swapping two parts of different branches exchanges their places', () => {
  const tree = parse('⿱⿰木口日', { open: true }).tree
  expect(write(swapParts(tree, [0, 0], [1]))).toBe('⿱⿰日口木')
  expect(write(swapParts(tree, [1], [0, 0]))).toBe('⿱⿰日口木')
  expect(write(swapParts(tree, [0], [1]))).toBe('⿱日⿰木口')
  expect(write(tree)).toBe('⿱⿰木口日')
})

test('swapping keeps both parts whole', () => {
  const tree = parse('⿰⿱日月⿲火水木', { open: true }).tree
  expect(write(swapParts(tree, [0], [1]))).toBe('⿰⿲火水木⿱日月')
})

test('an empty slot takes the place of a part', () => {
  const tree = parse('⿱⿰木⬚日', { open: true }).tree
  expect(write(swapParts(tree, [1], [0, 1]))).toBe('⿱⿰木日⬚')
  expect(write(swapParts(tree, [0, 1], [1]))).toBe('⿱⿰木日⬚')
})

test('a part does not exchange places with itself, a missing part or the part that holds it', () => {
  const tree = parse('⿰木⿱口日', { open: true }).tree
  for (const [from, to] of [[[], [0]], [[0], [0]], [[0], [0, 0]], [[1, 0], [1]], [[1], [1, 0]], [[1], [3]], [[1, 2], [0]]]) {
    expect(swapParts(tree, from, to)).toBe(tree)
  }
})

test('swapping two parts written the same leaves the tree as it was', () => {
  const tree = parse('⿰木木', { open: true }).tree
  expect(swapParts(tree, [0], [1])).toBe(tree)
})

test('a path follows its part as two parts exchange places', async () => {
  const { remapSwapPath, swappable } = await import('../src/svelte/part-drag.js')
  expect(remapSwapPath([0, 0], [0], [1])).toEqual([1, 0])
  expect(remapSwapPath([1, 2], [0], [1])).toEqual([0, 2])
  expect(remapSwapPath([0], [0], [1])).toEqual([1])
  expect(remapSwapPath([2], [0], [1])).toEqual([2])
  expect(swappable([0], [1])).toBe(true)
  expect(swappable([0], [0, 0])).toBe(false)
  expect(swappable([], [0])).toBe(false)
  expect(swappable([0], [0])).toBe(false)
})
