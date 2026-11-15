import { describe, expect, it } from 'bun:test'
import { parse, structureSkeleton } from '../src/core/index.js'

const skeleton = text => structureSkeleton(parse(text).tree)

describe('the skeleton of a description', () => {
  it('flattens nesting along one axis', () => {
    expect(skeleton('⿱⿱甲乙丙')).toBe('V(_,_,_)')
    expect(skeleton('⿱甲⿱乙丙')).toBe(skeleton('⿳甲乙丙'))
    expect(skeleton('⿰⿰甲乙丙')).toBe(skeleton('⿲甲乙丙'))
    expect(skeleton('⿱⿳甲乙丙丁')).toBe('V(_,_,_,_)')
  })
  it('keeps the two axes, and every other operator, apart', () => {
    expect(skeleton('⿱⿰甲乙丙')).toBe('V(H(_,_),_)')
    expect(skeleton('⿱甲乙')).not.toBe(skeleton('⿰甲乙'))
    expect(skeleton('⿸⿸甲乙丙')).toBe('⿸(⿸(_,_),_)')
  })
  it('reads two rows of two and two columns of two as one grid', () => {
    expect(skeleton('⿰⿱甲乙⿱丙丁')).toBe('GRID2x2')
    expect(skeleton('⿱⿰甲丙⿰乙丁')).toBe('GRID2x2')
  })
  it('reads a component as one slot', () => {
    expect(structureSkeleton('木')).toBe('_')
    expect(skeleton('⿰{53}&CDP-8BD0;')).toBe('H(_,_)')
  })
})
