import { describe, expect, it } from 'bun:test'
import { findLayer, fromSequence, readShareDocument, shareDocument } from '../src/document/index.js'

describe('document share tokens', () => {
  it('round-trips a document through a URL-safe token', () => {
    const document = fromSequence('⿰木口')
    document.title = 'Shared'
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }]
    const token = shareDocument(document)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    const read = readShareDocument(token)
    expect(read.title).toBe('Shared')
    expect(read.root.children[0].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }])
    expect(findLayer(read.root, read.root.children[0].id)).not.toBeNull()
  })
  it('rejects a token that is not a document', () => {
    expect(() => readShareDocument('e30')).toThrow()
  })
})
