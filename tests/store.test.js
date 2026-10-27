import { describe, expect, it } from 'bun:test'
import { SESSION_FORMAT, SessionRecordError, createDocumentSession, fromSequence, readSession, sessionFromRecord, sessionRecord, writeSession } from '../src/document/index.js'

const open = () => {
  const session = createDocumentSession(fromSequence('⿰木口'))
  session.choose(session.document.root.children[1].id)
  session.setTransform([{ type: 'affine', matrix: [1, 0, 0, 1, 4, 5] }])
  session.replace('水')
  return session
}

describe('a persisted document session', () => {
  it('keeps the document, chosen layer and every issued ID', () => {
    const session = open()
    const record = sessionRecord(session)
    expect(record).toMatchObject({ format: SESSION_FORMAT, version: 1, chosen: session.chosen })
    expect(record.document).not.toBe(session.document)
    expect(record.ids).toContain(session.chosen)
    expect(record.ids).toEqual([...session.allocator.ids])
  })
  it('round-trips through JSON without carrying undo history', () => {
    const session = open()
    const text = writeSession(session)
    const read = readSession(text)
    expect(read.sequence).toBe('⿰木水')
    expect(read.chosen).toBe(session.chosen)
    expect(read.document.root.children[1].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 4, 5] }])
    expect(read.canUndo).toBe(false)
    expect(read.allocator.ids).toEqual(session.allocator.ids)
    expect(text.endsWith('\n')).toBe(true)
  })
  it('does not reuse an ID that the stored session removed', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const removed = session.document.root.children[0].id
    session.choose(removed)
    session.remove()
    const read = readSession(writeSession(session))
    expect(read.allocator.ids.has(removed)).toBe(true)
    read.choose(read.document.root.children[0].id)
    const added = read.wrap('⿱')
    expect(added).not.toBe(removed)
  })
  it('rejects a record with another format, version or shape', () => {
    const record = sessionRecord(open())
    expect(() => sessionFromRecord({ ...record, format: 'ids-input/other' })).toThrow('not an ids-input/session record')
    expect(() => sessionFromRecord({ ...record, version: 2 })).toThrow('unsupported session record version 2')
    expect(() => sessionFromRecord({ ...record, chosen: 3 })).toThrow('chosen ID or null')
    expect(() => sessionFromRecord({ ...record, ids: [1] })).toThrow('array of IDs')
    expect(() => sessionFromRecord({ ...record, ids: ['x'.repeat(81)] })).toThrow(SessionRecordError)
    expect(() => sessionFromRecord({ ...record, document: {} })).toThrow(SessionRecordError)
  })
  it('rejects a chosen layer that the document does not hold', () => {
    const record = sessionRecord(open())
    expect(() => sessionFromRecord({ ...record, chosen: 'missing' })).toThrow('the chosen layer missing is not in the document')
  })
  it('rejects duplicate keys and numbers outside binary64', () => {
    const text = writeSession(open())
    expect(() => readSession(text.replace('"format": "ids-input/session"', '"format": "ids-input/session", "format": "ids-input/session"'))).toThrow('duplicate object key format')
    expect(() => readSession(text.replace('"version": 1', '"version": 1e400'))).toThrow('number outside finite binary64')
    expect(() => readSession('{')).toThrow('invalid JSON')
  })
})
