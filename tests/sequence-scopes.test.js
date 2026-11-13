import { expect, test } from 'bun:test'
import { tokens } from '../src/svelte/tokens.js'
import { sequenceScopes } from '../src/svelte/sequence-scopes.js'

const boxes = widths => { let x = 0; return widths.map(width => { const left = x; x += width; return {left, right: x} }) }

test('root scope segments its immediate operands and sits below nested scopes', () => {
  const scopes = sequenceScopes(tokens('⿰⿱木水火'), boxes([20, 20, 20, 20, 20]))
  expect(scopes.map(scope => [scope.path, scope.lane])).toEqual([[[], 1], [[0], 0]])
  expect(scopes[0].segments).toEqual([{ path: [0], d: 'M 22.5 10 H 77.5' }, { path: [1], d: 'M 82.5 10 H 97.5' }])
  expect(scopes[0].lead).toBe('M 1 0 C 1 10, 13.5 10, 17.5 10')
})

test('adjacent segments keep one fixed gap, and each lead stops one gap before its first segment', () => {
  const scopes = sequenceScopes(tokens('⿰⿱木火⿱日月'), boxes(Array(7).fill(20)))
  const segment = d => { const [, start, , end] = d.match(/M ([\d.]+) ([\d.]+) H ([\d.]+)/).map(Number); return {start, end} }
  for (const scope of scopes) {
    const segments = scope.segments.map(item => segment(item.d))
    for (let index = 1; index < segments.length; index++) {
      expect(segments[index].start - segments[index - 1].end).toBe(5)
    }
    expect(Number(scope.lead.match(/([\d.]+) ([\d.]+)$/)[1])).toBe(segments[0].start - 5)
  }
})

test('a lead starts one pixel inside the measured glyph ink', () => {
  const [scope] = sequenceScopes(tokens('⿰木'), [{left: 0, right: 20, inkLeft: 4}, {left: 20, right: 40}])
  expect(scope.lead).toBe('M 5 0 C 5 4, 13.5 4, 17.5 4')
})

test('geometry follows measured variable-width notes, emoji and selectors', () => {
  const spans = tokens('⿴[1]👩🏽‍💻𠀀\u{E0100}')
  const [scope] = sequenceScopes(spans, boxes([58, 31, 24]))
  expect(scope.segments).toEqual([{ path: [0], d: 'M 60.5 4 H 86.5' }, { path: [1], d: 'M 91.5 4 H 110.5' }])
})

test('invalid and unmeasured drafts have no lines; partial slots remain finite', () => {
  expect(sequenceScopes(tokens('⿰木木木'), [])).toEqual([])
  expect(sequenceScopes(tokens('⿰木'), [])).toEqual([])
  const [scope] = sequenceScopes(tokens('⿰木'), boxes([20, 20, 0]))
  expect(scope.segments).toEqual([{ path: [0], d: 'M 22.5 4 H 37.5' }])
  expect(scope.lead).not.toMatch(/NaN|Infinity/)
})

test('an operand the text still misses carries a marked scope of its own', () => {
  const [scope] = sequenceScopes(tokens('⿰木'), boxes([20, 20, 20]))
  expect(scope.segments).toEqual([
    { path: [0], d: 'M 22.5 4 H 37.5' },
    { path: [1], d: 'M 42.5 4 H 57.5', missing: true },
  ])
  const [all] = sequenceScopes(tokens('⿰'), boxes([20, 20, 20]))
  expect(all.segments).toEqual([
    { path: [0], d: 'M 22.5 4 H 37.5', missing: true },
    { path: [1], d: 'M 42.5 4 H 57.5', missing: true },
  ])
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
  expect(scopes[0].segments).toEqual([{ path: [0], d: `M 22.5 ${4 + (depth - 1) * 6} H ${20 * (depth + 1) - 2.5}` }])
})

test('disjoint branches reuse compact lanes', () => {
  const scopes = sequenceScopes(tokens('⿰⿱木水⿱火土'), boxes(Array(7).fill(20)))
  expect(scopes.map(scope => scope.lane)).toEqual([1, 0, 0])
})
