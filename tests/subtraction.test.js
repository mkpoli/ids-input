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

  it('takes the occurrence its index names, counted in reading order (zi.tools IDS Extension §6.7)', () => {
    // The examples of §6.7, on the descriptions zi.tools gives these characters.
    const described = { 王: ['⿱一土'], 土: ['⿱十一'], 十: ['⿻一丨'], 品: ['⿱口吅'], 吅: ['⿰口口'] }
    const read = text => normalizeSubtractionText(text, char => described[char] ?? [])
    expect(read('㇯王一')).toBe('土')
    expect(read('㇯[0]王一')).toBe('土')
    expect(read('㇯[1]王一')).toBe('⿱一⿱丨一')
    expect(read('㇯[2]王一')).toBe('⿱一十')
    expect(read('㇯品口')).toBe('吅')
    expect(read('㇯[1]品口')).toBe('⿱口口')
    expect(read('㇯[2]品口')).toBe('⿱口口')
    expect(read('⿰木㇯[2]王一')).toBe('⿰木⿱一十')
  })

  it('leaves an index past the last occurrence, or one that is no number', () => {
    const described = { 品: ['⿱口吅'], 吅: ['⿰口口'] }
    expect(normalizeSubtractionText('㇯[3]品口', char => described[char] ?? [])).toBe('㇯[3]品口')
    expect(subtractionRemainders(tree('品'), '口', char => described[char] ?? [], { index: 3 })).toEqual([])
  })

  it('neither counts nor takes the strokes of a stroke chain', () => {
    // 日 is 口 drawn as a chain with 一 inside: ㇯[1]日一 names no 一, and ㇯日一 is the chain, which
    // reads as the 口 it names.
    const described = { 日: ['⿴#(-丨𠃍-一z)一'] }
    expect(normalizeSubtractionText('㇯[1]日一', char => described[char] ?? [])).toBe('㇯[1]日一')
    expect(normalizeSubtractionText('㇯日一', char => described[char] ?? [])).toBe('口')
  })

  it('counts through the spelling of a character that shows the most occurrences', () => {
    // 尖 is also written ⿱𡭔大, which shows no 小: that spelling does not shift the count.
    const described = { 尜: ['⿱小尖'], 尖: ['⿱𡭔大', '⿱小大'] }
    const read = text => normalizeSubtractionText(text, char => described[char] ?? [])
    expect(read('㇯尜小')).toBe('尖')
    expect(read('㇯[1]尜小')).toBe('⿱小大')
  })

  it('does not take a stroke chain out whole', () => {
    // A chain the grammar does not name stays a chain (a named one reads as its character).
    const described = { 甲: ['⿴#(-丨𠃍x0)一'] }
    expect(subtractionRemainders(tree('甲'), '#(-丨𠃍x0)', char => described[char] ?? [], { index: 0 })).toEqual([])
    expect(subtractionRemainders(tree('甲'), '#(-丨𠃍x0)', char => described[char] ?? [])).toEqual([])
    expect(subtractionRemainders(tree('甲'), '一', char => described[char] ?? [], { index: 0 }).map(write)).toEqual(['#(-丨𠃍x0)'])
  })

  it('offers each occurrence without an index, and the named one with it', () => {
    const described = { 王: ['⿱一土'], 土: ['⿱十一'], 十: ['⿻一丨'] }
    const describe = char => described[char] ?? []
    expect(subtractionRemainders(tree('王'), '一', describe).map(write)).toEqual(['土', '⿱一⿱丨一', '⿱一十'])
    expect(subtractionRemainders(tree('王'), '一', describe, { index: 2 }).map(write)).toEqual(['⿱一十'])
  })

  it('stops on a cycle of descriptions', () => {
    const cyclic = { 甲: ['⿰甲乙'], 乙: ['⿱甲口'] }
    const result = normalizeSubtractions(tree('㇯甲口'), char => cyclic[char] ?? [])
    expect(write(result)).toBe('⿰甲甲')
  })
})
