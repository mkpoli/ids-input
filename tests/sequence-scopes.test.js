import { expect, test } from 'bun:test'
import { tokens } from '../src/svelte/tokens.js'
import { sequenceScopes } from '../src/svelte/sequence-scopes.js'

const boxes = widths => { let x = 0; return widths.map(width => { const left = x; x += width; return {left, right: x} }) }

test('root scope segments its immediate operands and sits below nested scopes', () => {
  const scopes = sequenceScopes(tokens('⿰⿱木水火'), boxes([20, 20, 20, 20, 20]))
  expect(scopes.map(scope => [scope.path, scope.lane])).toEqual([[[], 1], [[0], 0]])
  expect(scopes[0].segments).toEqual([{ path: [0], d: 'M 21.5 10 H 78.5' }, { path: [1], d: 'M 81.5 10 H 98.5' }])
  expect(scopes[0].lead).toBe('M 6 0 C 6 10, 16 10, 20 10')
})

test('geometry follows measured variable-width notes, emoji and selectors', () => {
  const spans = tokens('⿴[1]👩🏽‍💻𠀀\u{E0100}')
  const [scope] = sequenceScopes(spans, boxes([58, 31, 24]))
  expect(scope.segments).toEqual([{ path: [0], d: 'M 59.5 4 H 87.5' }, { path: [1], d: 'M 90.5 4 H 111.5' }])
})

test('invalid and unmeasured drafts have no lines; partial slots remain finite', () => {
  expect(sequenceScopes(tokens('⿰木木木'), [])).toEqual([])
  expect(sequenceScopes(tokens('⿰木'), [])).toEqual([])
  const [scope] = sequenceScopes(tokens('⿰木'), boxes([20, 20, 0]))
  expect(scope.segments).toEqual([{ path: [0], d: 'M 21.5 4 H 38.5' }])
  expect(scope.lead).not.toMatch(/NaN|Infinity/)
  expect(sequenceScopes(tokens('⿰'), boxes([20, 0, 0]))).toEqual([])
})

test('loose marks on a leaf do not create an operator scope', () => {
  expect(sequenceScopes(tokens('木\u302A'), boxes([20, 8]))).toEqual([])
})

test('deep unary drafts cache subtree heights and extents without recursive rescans', () => {
  const depth = 400
  const spans = tokens('⿾'.repeat(depth) + '木')
  const measured = boxes(Array(depth + 1).fill(20))
  const scopes = sequenceScopes(spans, measured)
  expect(scopes).toHaveLength(depth)
  expect(scopes[0].lane).toBe(depth - 1)
  expect(scopes.at(-1).lane).toBe(0)
  expect(scopes[0].segments).toEqual([{ path: [0], d: `M 21.5 ${4 + (depth - 1) * 6} H ${20 * (depth + 1) - 1.5}` }])
})

test('disjoint branches reuse compact lanes', () => {
  const scopes = sequenceScopes(tokens('⿰⿱木水⿱火土'), boxes(Array(7).fill(20)))
  expect(scopes.map(scope => scope.lane)).toEqual([1, 0, 0])
})
