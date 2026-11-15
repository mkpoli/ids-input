// The しんぞ description, from its Wikimedia Commons category, read 2026-11-14:
// https://commons.wikimedia.org/wiki/Category:しんぞ漢字
import { describe, expect, it } from 'bun:test'
import { leaves, parse, write } from '../src/core/index.js'
import { createDocumentSession, fromSequence, toSequence, validateDocument } from '../src/document/index.js'

const SHINZO = '⿸疒⿱⿱甘⿻帀⿰⿰⿳⿰翳翳⿰輒輒罒⿰⿱丽𩙿⿱⿳⺈罒比⿻兔丶⿰⿰⿱丽𩙿⿱⿳⺈罒比⿻兔丶⿳⿰翳翳⿰輒輒罒⿱⿱⿲⿲袮袮袮⿵門⿳⿰雷雷⿰雷雷鬮⿲袮袮袮⿲田⿳⿲𧢱馬⿰角𩙤⿲圡蟐⿲𦧅蟐圡⿰⿰𪓊𦧄⿰⿱⿰鏡鏡⿰鏡鏡𪓊田心'

describe('a long description', () => {
  it('reads and writes the しんぞ description', () => {
    expect([...SHINZO]).toHaveLength(102)
    const read = parse(SHINZO)
    expect(read.problem).toBeUndefined()
    expect(leaves(read.tree)).toHaveLength(58)
    expect(write(read.tree)).toBe(SHINZO)
  })

  it('holds the description in a document', () => {
    const document = fromSequence(SHINZO)
    expect(toSequence(document.root)).toBe(SHINZO)
    expect(validateDocument(document)).toEqual([])
    const session = createDocumentSession(document)
    expect(() => session.sync(parse(SHINZO).tree)).not.toThrow()
    expect(session.sequence).toBe(SHINZO)
  })
})
