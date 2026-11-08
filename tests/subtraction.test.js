import { describe, expect, it } from 'bun:test'
import { normalizeSubtractions, normalizeSubtractionText, parse, subtractionRemainders, write } from '../src/core/index.js'

// A small decomposition table; the characters stand for their BabelStone descriptions.
const DESCRIPTIONS = {
  軍: ['⿱冖車'], 輝: ['⿰光軍'], 光: ['⿱⺌兀'], 車: ['⿻亘丨'], 木: ['⿻十八'], 口: ['口'],
  甲: ['⿰甲乙'], 乙: ['⿱甲口'],
}
/** @param {string} char */
const decomposition = char => DESCRIPTIONS[char] ?? []
/** @param {string} text */
const tree = text => {
  const result = parse(text, { open: true })
  if (result.problem) throw new Error(result.problem)
  return result.tree
}
/** @param {Part} part */
const normalized = part => write(normalizeSubtractions(part, decomposition))

describe('subtraction normalization', () => {
  it('reads ㇯軍車 as 冖, because 軍 is ⿱冖車', () => {
    expect(normalized(tree('㇯軍車'))).toBe('冖')
    expect(subtractionRemainders(tree('軍'), '車', decomposition).map(write)).toEqual(['冖'])
  })

  it('normalizes a subtraction inside a larger description', () => {
    expect(normalized(tree('⿰光㇯軍車'))).toBe('⿰光冖')
    expect(normalizeSubtractionText('⿰光㇯軍車', decomposition)).toBe('⿰光冖')
  })

  it('follows descriptions recursively', () => {
    expect(normalized(tree('㇯輝車'))).toBe('⿰光冖')
  })

  it('takes the occurrence out of its own node', () => {
    expect(normalized(tree('㇯⿰⿱艹木口木'))).toBe('⿰艹口')
    expect(normalized(tree('㇯⿰木木木'))).toBe('木')
  })

  it('leaves a subtraction the descriptions do not resolve', () => {
    expect(normalized(tree('㇯軍光'))).toBe('㇯軍光')
    expect(normalizeSubtractionText('㇯軍光', decomposition)).toBe('㇯軍光')
  })

  it('leaves one that would take the whole description away', () => {
    expect(normalized(tree('㇯軍軍'))).toBe('㇯軍軍')
  })

  it('leaves a node whose operator cannot be written with the parts that remain', () => {
    expect(normalized(tree('㇯⿲木口木口'))).toBe('㇯⿲木口木口')
  })

  it('keeps drafts and undecided operands as typed', () => {
    expect(normalizeSubtractionText('⿰光㇯軍', decomposition)).toBe('⿰光㇯軍')
    expect(normalizeSubtractionText('㇯⬚軍', decomposition)).toBe('㇯⬚軍')
    expect(normalizeSubtractionText('光', decomposition)).toBe('光')
  })

  it('does not read a description that is itself a subtraction as parts', () => {
    const described = { 乌: ['㇯鸟丶'], 鸟: ['⿱一鸟'] }
    expect(normalizeSubtractionText('㇯乌丶', char => described[char] ?? [])).toBe('㇯乌丶')
  })

  it('does not resolve a placeholder or a target carrying one', () => {
    expect(normalizeSubtractionText('㇯甲？', char => ({ 甲: ['⿱？木'] })[char] ?? [])).toBe('㇯甲？')
    expect(normalizeSubtractionText('⿰光㇯甲木', char => ({ 甲: ['⿱？木'] })[char] ?? [])).toBe('⿰光㇯甲木')
  })

  it('stops on a cycle of descriptions', () => {
    const cyclic = { 甲: ['⿰甲乙'], 乙: ['⿱甲口'] }
    const result = normalizeSubtractions(tree('㇯甲口'), char => cyclic[char] ?? [])
    expect(write(result)).toBe('⿰甲甲')
  })
})
