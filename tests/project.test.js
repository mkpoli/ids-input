import { describe, expect, it } from 'bun:test'
import { arity, parse } from '../src/core/ids.js'
import {
  DocumentError, allocatorFor, documentFromTree, emptyDocument, fromSequence, syncDocument, toSequence, treeFromDocument,
} from '../src/document/index.js'

const tree = sequence => parse(sequence, { open: true }).tree
const doc = sequence => fromSequence(sequence)

describe('projecting a document to the editor tree', () => {
  it('writes components, slots, operators and groups as the core tree', () => {
    const document = doc('⿰木⬚')
    expect(treeFromDocument(document)).toEqual({ op: '⿰', parts: ['木', null] })
    const grouped = /** @type {any} */ (document)
    grouped.root = { id: 'g', kind: 'group', child: grouped.root }
    expect(treeFromDocument(grouped)).toEqual({ op: '⿰', parts: ['木', null] })
  })
  it('refuses a tree whose parts would merge when written', () => {
    expect(() => documentFromTree({ op: '⿰', parts: [String.fromCodePoint(0x1100), String.fromCodePoint(0x1161)] })).toThrow(DocumentError)
  })
  it('builds a document from a tree with fresh IDs', () => {
    const made = documentFromTree(tree('⿱木口'))
    expect(toSequence(made.root)).toBe('⿱木口')
    expect(made.root.kind).toBe('operator')
  })
})

describe('syncing an editor tree into a document', () => {
  it('keeps every ID and transform when the tree is unchanged', () => {
    const document = doc('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 3, 4] }]
    const ids = JSON.stringify(document)
    const next = syncDocument(document, treeFromDocument(document))
    expect(JSON.stringify(next)).toBe(ids)
  })
  it('keeps the layer ID and transform through a replacement', () => {
    const document = doc('⿰木口')
    const left = document.root.children[0]
    const right = document.root.children[1]
    left.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }]
    const next = syncDocument(document, tree('⿰水口'))
    expect(next.root.children[0]).toMatchObject({ id: left.id, char: '水', transform: left.transform })
    expect(next.root.children[1].id).toBe(right.id)
    expect(toSequence(next.root)).toBe('⿰水口')
  })
  it('keeps the node ID when its operator changes and keeps children by position', () => {
    const document = doc('⿰木口')
    const root = document.root
    const left = root.children[0], right = root.children[1]
    root.transform = [{ type: 'affine', matrix: [2, 0, 0, 2, 0, 0] }]
    const next = syncDocument(document, tree('⿱口木'))
    expect(next.root).toMatchObject({ id: root.id, op: '⿱', transform: root.transform })
    expect(next.root.children[0].id).toBe(left.id)
    expect(next.root.children[1].id).toBe(right.id)
    expect(toSequence(next.root)).toBe('⿱口木')
  })
  it('keeps the ID at a path when a component becomes an operator', () => {
    const document = doc('⿰木口')
    const left = document.root.children[0], right = document.root.children[1]
    left.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 1, 2] }]
    const next = syncDocument(document, tree('⿰⿱木口口'))
    expect(next.root.children[0]).toMatchObject({ id: left.id, kind: 'operator', op: '⿱', transform: left.transform })
    expect(next.root.children[1].id).toBe(right.id)
    expect(next.root.children[0].children).toHaveLength(2)
    expect(next.root.children[0].children[0].id).not.toBe(left.id)
    expect(toSequence(next.root)).toBe('⿰⿱木口口')
  })
  it('keeps a group around the part at its path', () => {
    const document = doc('木')
    const child = document.root
    document.root = { id: 'group', kind: 'group', child, transform: [{ type: 'affine', matrix: [1, 0, 0, 1, 5, 5] }] }
    const next = syncDocument(document, tree('水'))
    expect(next.root).toMatchObject({ id: 'group', kind: 'group', transform: document.root.transform })
    if (next.root.kind === 'group') expect(next.root.child).toMatchObject({ id: child.id, char: '水' })
    expect(toSequence(next.root)).toBe('水')
  })
  it('keeps the root ID and transform from an empty slot', () => {
    const document = emptyDocument('root')
    document.root.transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 7, 8] }]
    const next = syncDocument(document, tree('木'))
    expect(next.root).toMatchObject({ id: 'root', kind: 'component', char: '木', transform: document.root.transform })
  })
  it('preserves metadata outside the tree', () => {
    const document = doc('木')
    document.title = 'Title'
    document.extensions = { 'example.org/x': { value: 1 } }
    const next = syncDocument(document, tree('口'))
    expect(next.title).toBe('Title')
    expect(next.extensions).toEqual(document.extensions)
  })
  it('does not reuse an ID removed through the tree when given the session allocator', () => {
    const document = doc('⿰木口')
    const allocator = allocatorFor(document)
    const removed = document.root.children[1].id
    const without = syncDocument(document, tree('木'), { allocator })
    expect(without.root.kind).toBe('component')
    const next = syncDocument(without, tree('⿰木口'), { allocator })
    expect(next.root.kind).toBe('operator')
    expect(next.root.children).toHaveLength(2)
    expect(next.root.children[0].id).not.toBe(removed)
    expect(next.root.children[1].id).not.toBe(removed)
    expect(allocator.ids.has(removed)).toBe(true)
  })
  it('keeps a slot as a slot with its ID', () => {
    const document = doc('⬚')
    const next = syncDocument(document, null)
    expect(next.root).toMatchObject({ id: document.root.id, kind: 'slot' })
  })
})
