import { describe, expect, it } from 'bun:test'
import { DocumentError, findLayer, fromSequence, readShareDocument, shareDocument, toSequence, writeDocument } from '../src/document/index.js'

const b64 = text => Buffer.from(text).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('document share tokens', () => {
  it('has no token for a document its sequence already spells', () => {
    expect(shareDocument(fromSequence('⿺电尼'))).toBe('')
  })
  it('round-trips what the sequence cannot carry', () => {
    const document = fromSequence('⿰木口')
    document.title = 'Shared'
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }]
    document.root.name = 'root name'
    document.root.children[1].extensions = { note: true }
    const token = shareDocument(document)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    const read = readShareDocument(token)
    expect(toSequence(read.root)).toBe('⿰木口')
    expect(read.title).toBe('Shared')
    expect(read.root.name).toBe('root name')
    expect(read.root.children[0].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }])
    expect(read.root.children[1].extensions).toEqual({ note: true })
    expect(findLayer(read.root, read.root.children[0].id)).not.toBeNull()
  })
  it('regenerates the same IDs every read', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 1, 0] }]
    const token = shareDocument(document)
    expect(readShareDocument(token).root.children[0].id).toBe(readShareDocument(token).root.children[0].id)
  })
  it('keeps a group, which a sequence cannot spell', () => {
    const document = fromSequence('⿰木口')
    document.root.children[1] = { id: 'g', kind: 'group', child: document.root.children[1], name: 'wrap' }
    const read = readShareDocument(shareDocument(document))
    const group = read.root.children[1]
    expect(group.kind).toBe('group')
    expect(group.name).toBe('wrap')
    expect(group.child.kind).toBe('component')
    expect(toSequence(read.root)).toBe('⿰木口')
  })
  it('carries a group at the root', () => {
    const document = fromSequence('木')
    document.root = { id: 'root', kind: 'group', child: { ...document.root, id: 'inner' }, name: 'outer' }
    const read = readShareDocument(shareDocument(document))
    expect(read.root.kind).toBe('group')
    expect(read.root.name).toBe('outer')
    expect(read.root.child.kind).toBe('component')
    expect(toSequence(read.root)).toBe('木')
    expect(new Set([read.root.id, read.root.child.id]).size).toBe(2)
  })
  it('carries geometry edits by path', () => {
    const document = fromSequence('⿰木口')
    document.render = { mode: 'pinned', engine: 'han-compose', revision: '1', options: {}, assets: [{ role: 'a', sha256: 'a'.repeat(64) }] }
    document.geometryEdits = [{ id: 'e1', node: document.root.children[0].id, geometry: 'b'.repeat(64), target: { kind: 'stroke', id: 's1' }, transform: [{ type: 'affine', matrix: [1, 0, 0, 1, 3, 4] }] }]
    const read = readShareDocument(shareDocument(document))
    expect(read.geometryEdits?.[0].node).toBe(read.root.children[0].id)
    expect(read.geometryEdits?.[0].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 3, 4] }])
  })
  it('stays far shorter than the document it describes', () => {
    const document = fromSequence('⿰木口')
    document.title = 'Shared'
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }]
    expect(shareDocument(document).length * 2).toBeLessThan(b64(writeDocument(document)).length)
  })
  it('leaves an edit whose target is gone without one', () => {
    const document = fromSequence('⿰木口')
    document.render = { mode: 'pinned', engine: 'e', revision: '1', options: {}, assets: [{ role: 'a', sha256: 'a'.repeat(64) }] }
    document.geometryEdits = [{ id: 'e1', node: 'l2', geometry: 'b'.repeat(64), target: { kind: 'stroke', id: 's1' }, transform: [] }]
    expect(document.root.children[0].id).toBe('l2')
    document.root.children[0] = { id: 'other', kind: 'component', char: '木' }
    const read = readShareDocument(shareDocument(document))
    expect(read.root.children[0].id).not.toBe('l2')
    expect(read.geometryEdits?.[0].node).toBe('l2')
    expect(findLayer(read.root, 'l2')).toBeNull()
  })
  it('keeps extensions on an unbound recipe', () => {
    const document = fromSequence('木')
    document.render = { mode: 'unbound', extensions: { source: 'custom' } }
    expect(shareDocument(document)).not.toBe('')
    expect(readShareDocument(shareDocument(document)).render.extensions).toEqual({ source: 'custom' })
  })
  it('reads one document the same way however its keys are ordered', () => {
    const document = fromSequence('⿰木口')
    document.root.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }]
    const reordered = fromSequence('⿰木口')
    reordered.root = { id: 'root', kind: 'operator', transform: document.root.transform, op: '⿰', children: document.root.children }
    expect(shareDocument(reordered)).toBe(shareDocument(document))
  })
  it('rejects a token that is not one', () => {
    expect(() => readShareDocument('e30')).toThrow(DocumentError)
  })
  it('rejects a layer path the sequence does not have', () => {
    expect(() => readShareDocument(b64(JSON.stringify({ v: 1, s: '⿰木口', l: [['3', { n: 'x' }]] })))).toThrow(DocumentError)
  })
  it('reads a token from the whole-document format', () => {
    const document = fromSequence('⿰木口')
    document.title = 'Older'
    expect(readShareDocument(b64(JSON.stringify(document))).title).toBe('Older')
  })
})
