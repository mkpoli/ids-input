import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  DocumentError, allocatorFor, changeOperator, createAllocator, decompose, deleteLayer, documentIds, duplicateSubtree,
  emptyDocument, findLayer, fromSequence, layers, readDocument, replaceNode, replaceWithSequence, toSequence, unwrapNode,
  validateDocument, wrapNode, writeDocument,
} from '../src/document/index.js'

const child = (document, index) => layers(document.root)[index]
const transform = [{ type: 'affine', matrix: [0.9, 0, 0, 1.1, 12, -3] }]

describe('a document from IDS', () => {
  it('projects back to the same sequence, with a fresh ID for every layer', () => {
    const document = fromSequence('⿰木⬚')
    expect(toSequence(document.root)).toBe('⿰木⬚')
    expect(layers(document.root)).toHaveLength(3)
    expect(new Set(documentIds(document)).size).toBe(3)
    expect(emptyDocument().root).toEqual({ id: 'root', kind: 'slot' })
    expect(toSequence(emptyDocument().root)).toBe('⬚')
  })
  it('gives repeated characters separate IDs', () => {
    const document = fromSequence('⿰木木')
    const [left, right] = document.root.children
    expect(left.char).toBe('木')
    expect(right.char).toBe('木')
    expect(left.id).not.toBe(right.id)
  })
  it('refuses text that is not an open IDS draft', () => {
    expect(() => fromSequence('木口')).toThrow(DocumentError)
    expect(() => fromSequence('⿰木')).not.toThrow()
  })
  it('keeps IDs unique even when the root ID is one the allocator would make', () => {
    const document = fromSequence('⿰木口', { id: 'l2' })
    const ids = documentIds(document)
    expect(new Set(ids).size).toBe(ids.length)
    expect(document.root.id).toBe('l2')
  })
})

describe('document validation', () => {
  it('accepts the published example and round-trips it', () => {
    const text = readFileSync(new URL('../docs/ids-document.example.json', import.meta.url), 'utf8')
    const document = readDocument(text)
    expect(toSequence(document.root)).toBe('⿰木⿱口木')
    expect(readDocument(writeDocument(document))).toEqual(document)
  })
  it('rejects duplicate object keys before schema validation', () => {
    const text = writeDocument(emptyDocument()).replace('"render"', '"title": "a", "title": "b", "render"')
    expect(() => readDocument(text)).toThrow('duplicate object key title')
  })
  it('accepts a slot root, groups, unknown operations and opaque extensions', () => {
    expect(validateDocument(emptyDocument())).toEqual([])
    const wrapped = emptyDocument()
    wrapped.root = { id: 'wrap', kind: 'group', child: wrapped.root }
    wrapped.root.transform = [{ type: 'example.org/warp', parameters: { strength: 3 } }]
    wrapped.extensions = { 'example.org/editor': { note: 'kept' } }
    expect(validateDocument(wrapped)).toEqual([])
  })
  it('rejects duplicate IDs, bad arity, bad components and singular matrices', () => {
    const duplicate = fromSequence('⿰木口')
    duplicate.root.children[1].id = duplicate.root.children[0].id
    expect(validateDocument(duplicate).map(issue => issue.message)).toContain('duplicate layer ID l2')

    const arity = fromSequence('⿰木口')
    arity.root.children.pop()
    expect(validateDocument(arity).map(issue => issue.message)).toContain('wrong number of operands')

    const component = fromSequence('⿰木口')
    component.root.children[0].char = '木口'
    expect(validateDocument(component).map(issue => issue.message)).toContain('not a variation selector')

    const singular = emptyDocument()
    singular.root.transform = [{ type: 'affine', matrix: [0, 0, 0, 0, 0, 0] }]
    expect(validateDocument(singular).map(issue => issue.message)).toContain('singular affine matrix')
  })
  it('does not throw on an unknown node kind', () => {
    const document = emptyDocument()
    document.root.kind = 'other'
    expect(validateDocument(document).map(issue => issue.message)).toContain('unknown layer kind')
  })
  it('rejects unknown fields and keeps opaque extensions', () => {
    const document = emptyDocument()
    document.unexpected = true
    expect(validateDocument(document).map(issue => issue.path)).toContain('/unexpected')
    const kept = emptyDocument()
    kept.extensions = { 'example.org/editor': { value: 1 } }
    expect(validateDocument(kept)).toEqual([])
  })
  it('requires a pinned recipe for geometry edits and checks their shape', () => {
    const document = emptyDocument()
    document.geometryEdits = [{ id: 'e1', node: 'root', geometry: '1'.repeat(64), target: { kind: 'contour', piece: 0, contour: 0 }, transform: [] }]
    expect(validateDocument(document).map(issue => issue.message)).toContain('geometry edits need a pinned recipe')
    document.render = { mode: 'pinned', engine: 'x', revision: '1', options: {}, assets: [{ role: 'font', sha256: '0'.repeat(64) }] }
    expect(validateDocument(document)).toEqual([])
  })
})

describe('identity edits', () => {
  it('replaces a component, keeping its ID, name and transform', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 2)
    target.name = '口'
    target.transform = transform
    const next = replaceWithSequence(document, target.id, '水')
    const kept = findLayer(next.root, target.id)
    expect(kept?.node).toMatchObject({ id: target.id, kind: 'component', char: '水', name: '口', transform })
    expect(toSequence(next.root)).toBe('⿰木水')
    expect(document.root.children[1].char).toBe('口')
  })
  it('replaces structured content and gives its children fresh IDs', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 2)
    const next = replaceNode(document, target.id, { kind: 'operator', op: '⿱', children: [{ kind: 'component', char: '口' }, { kind: 'component', char: '木' }] })
    const kept = findLayer(next.root, target.id)
    expect(kept?.node.kind).toBe('operator')
    const ids = documentIds(next)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => id.startsWith('l'))).toHaveLength(4)
  })
  it('decomposes a component in place, keeping its ID and transform', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 2)
    target.transform = transform
    const next = decompose(document, target.id, '⿱口木')
    const kept = findLayer(next.root, target.id)
    expect(kept?.node).toMatchObject({ id: target.id, kind: 'operator', op: '⿱', transform })
    expect(validateDocument(next)).toEqual([])
  })
  it('unwraps an all-slot operator into a group around its first slot', () => {
    const document = fromSequence('⿰⬚⬚')
    const first = document.root.children[0]
    const next = unwrapNode(document, document.root.id)
    expect(next.root).toMatchObject({ id: 'root', kind: 'group', child: { id: first.id, kind: 'slot' } })
    expect(toSequence(next.root)).toBe('⬚')
  })
  it('wraps and unwraps a layer without losing its identity', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 1)
    target.transform = transform
    const wrapped = wrapNode(document, target.id, '⿲')
    const operator = findLayer(wrapped.document.root, wrapped.id)
    expect(operator?.node).toMatchObject({ id: wrapped.id, kind: 'operator', op: '⿲' })
    expect(operator?.node.kind === 'operator' ? operator.node.children[0] : null).toMatchObject({ id: target.id, transform })
    const next = unwrapNode(wrapped.document, wrapped.id)
    const group = findLayer(next.root, wrapped.id)
    expect(group?.node).toMatchObject({ id: wrapped.id, kind: 'group', child: { id: target.id, transform } })
    expect(toSequence(next.root)).toBe('⿰木口')
  })
  it('changes an operator, adding slots and refusing to discard a filled operand', () => {
    const document = fromSequence('⿰木口')
    const next = changeOperator(document, document.root.id, '⿲')
    expect(toSequence(next.root)).toBe('⿲木口⬚')
    const full = fromSequence('⿲木口木')
    expect(() => changeOperator(full, full.root.id, '⿰')).toThrow(DocumentError)
    const cleared = changeOperator(next, next.root.id, '⿰')
    expect(toSequence(cleared.root)).toBe('⿰木口')
  })
  it('deletes a layer into a fresh slot and refuses the root', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 1)
    const next = deleteLayer(document, target.id)
    expect(toSequence(next.root)).toBe('⿰⬚口')
    expect(findLayer(next.root, target.id)).toBeNull()
    expect(() => deleteLayer(document, document.root.id)).toThrow(DocumentError)
  })
  it('copies a subtree with fresh IDs and keeps its transforms', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 2)
    target.transform = transform
    const allocator = createAllocator(documentIds(document))
    const copy = duplicateSubtree(target, allocator)
    expect(copy.id).not.toBe(target.id)
    expect(copy.transform).toEqual(transform)
    expect(documentIds({ ...document, root: copy })).not.toContain(target.id)
  })
  it('does not reuse an ID that a removed layer held', () => {
    const document = fromSequence('⿰木口')
    const target = child(document, 1)
    const allocator = allocatorFor(document)
    const next = deleteLayer(document, target.id, { allocator })
    expect(documentIds(next)).not.toContain(target.id)
    expect(allocator.next()).not.toBe(target.id)
  })
  it('reserves geometry-edit targets so a removed layer ID cannot return', () => {
    const document = emptyDocument()
    document.render = { mode: 'pinned', engine: 'x', revision: '1', options: {}, assets: [{ role: 'font', sha256: '0'.repeat(64) }] }
    document.geometryEdits = [{ id: 'e1', node: 'gone', geometry: '1'.repeat(64), target: { kind: 'contour', piece: 0, contour: 0 }, transform: [] }]
    expect(allocatorFor(document).ids.has('gone')).toBe(true)
  })
})
