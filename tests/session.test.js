import { describe, expect, it } from 'bun:test'
import { parse } from '../src/core/ids.js'
import { DocumentError, createDocumentSession, documentIds, findLayer, fromSequence, toSequence, treeFromDocument, validateDocument } from '../src/document/index.js'

const transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 12, -3] }]
const tree = sequence => parse(sequence, { open: true }).tree
const layer = (session, index) => session.document.root.children[index]

describe('a document session', () => {
  it('starts from an empty slot or a document and chooses a layer', () => {
    const empty = createDocumentSession()
    expect(empty.sequence).toBe('⬚')
    expect(empty.document.root).toMatchObject({ kind: 'slot' })
    expect(empty.choose('missing')).toBe(false)

    const session = createDocumentSession(fromSequence('⿰木口'))
    expect(session.sequence).toBe('⿰木口')
    expect(session.choose(layer(session, 0).id)).toBe(true)
    expect(session.chosen).toBe(layer(session, 0).id)
    expect(session.choose(null)).toBe(true)
    expect(session.chosen).toBeNull()
  })
  it('replaces the chosen layer, keeping its ID and transform, and undoes the whole edit', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 1)
    session.choose(target.id)
    session.setTransform(transform)
    expect(session.canUndo).toBe(true)
    session.replace('水')
    const kept = findLayer(session.document.root, target.id)
    expect(kept?.node).toMatchObject({ id: target.id, char: '水', transform })
    expect(session.sequence).toBe('⿰木水')
    expect(session.undo()).toBe(true)
    expect(session.sequence).toBe('⿰木口')
    expect(findLayer(session.document.root, target.id)?.node.transform).toEqual(transform)
    expect(session.undo()).toBe(true)
    expect(findLayer(session.document.root, target.id)?.node.transform).toBeUndefined()
    expect(session.redo()).toBe(true)
    expect(session.redo()).toBe(true)
    expect(session.sequence).toBe('⿰木水')
  })
  it('decomposes in place and keeps the chosen ID across undo', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 1)
    session.choose(target.id)
    session.decompose('⿱口木')
    expect(session.sequence).toBe('⿰木⿱口木')
    expect(session.document.root.children[1].id).toBe(target.id)
    expect(session.chosen).toBe(target.id)
    session.undo()
    expect(session.sequence).toBe('⿰木口')
    expect(session.chosen).toBe(target.id)
  })
  it('wraps and unwraps, choosing the new operator and keeping its identity', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 0)
    session.choose(target.id)
    const wrapped = session.wrap('⿲')
    expect(session.chosen).toBe(wrapped)
    expect(findLayer(session.document.root, wrapped)?.node.kind).toBe('operator')
    expect(findLayer(session.document.root, wrapped)?.node.transform).toBeUndefined()
    session.unwrap()
    const group = findLayer(session.document.root, wrapped)
    expect(group?.node).toMatchObject({ kind: 'group', child: { id: target.id } })
    expect(session.canUndo).toBe(true)
  })
  it('removes into a fresh slot and chooses the parent', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 0)
    const parent = session.document.root.id
    session.choose(target.id)
    session.remove()
    expect(session.sequence).toBe('⿰⬚口')
    expect(session.chosen).toBe(parent)
    expect(documentIds(session.document)).not.toContain(target.id)
  })
  it('clears a layer to a slot while keeping its ID and transform', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 1)
    session.choose(target.id)
    session.setTransform(transform)
    session.clear()
    expect(session.sequence).toBe('⿰木⬚')
    expect(findLayer(session.document.root, target.id)?.node).toMatchObject({ id: target.id, kind: 'slot', transform })
  })
  it('sets and clears a document title as one undoable step', () => {
    const session = createDocumentSession(fromSequence('木'))
    session.setTitle('  Example  ')
    expect(session.document.title).toBe('Example')
    expect(session.steps.done.at(-1)).toBe('Title Example')
    session.setTitle('')
    expect(session.document.title).toBeUndefined()
    session.undo()
    expect(session.document.title).toBe('Example')
  })
  it('names a transform by its layer', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    session.choose(layer(session, 0).id)
    session.setTransform(transform)
    expect(session.steps.done.at(-1)).toBe('Transform 木')
  })
  it('coalesces one gesture into one undo step', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 0).id
    session.choose(target)
    session.setTransform([{ type: 'affine', matrix: [1, 0, 0, 1, 1, 0] }], target, { coalesce: 'drag-1' })
    session.setTransform([{ type: 'affine', matrix: [1, 0, 0, 1, 2, 0] }], target, { coalesce: 'drag-1' })
    expect(session.steps.done).toHaveLength(1)
    session.undo()
    expect(findLayer(session.document.root, target)?.node.transform).toBeUndefined()
  })
  it('keeps history across an unchanged editor sync', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    session.choose(layer(session, 0).id)
    session.setTransform(transform)
    expect(session.sync(treeFromDocument(session.document))).toBe(false)
    expect(session.canUndo).toBe(true)
  })
  it('clears history when an editor sync changes the structure', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    session.choose(layer(session, 0).id)
    session.setTransform(transform)
    expect(session.sync(tree('⿰水口'))).toBe(true)
    expect(session.sequence).toBe('⿰水口')
    expect(session.canUndo).toBe(false)
  })
  it('rejects an invalid transform without touching the document or history', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    session.choose(layer(session, 0).id)
    const before = session.document
    expect(() => session.setTransform([{ type: 'affine', matrix: [0, 0, 0, 0, 0, 0] }])).toThrow(DocumentError)
    expect(session.document).toEqual(before)
    expect(session.canUndo).toBe(false)
  })
  it('isolates the current document and undo history from returned documents', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const before = session.document
    const target = before.root.children[0].id
    before.root.children[0].char = '火'
    expect(session.sequence).toBe('⿰木口')
    expect(session.canUndo).toBe(false)

    const previous = session.document
    session.choose(target)
    session.replace('水')
    const current = session.document
    previous.root.children[0].char = '火'
    current.root.children[0].char = '土'
    expect(session.sequence).toBe('⿰水口')
    expect(session.undo()).toBe(true)
    expect(session.sequence).toBe('⿰木口')
    expect(session.redo()).toBe(true)
    expect(session.sequence).toBe('⿰水口')
  })
  it('keeps a removed ID out of the allocator', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const removed = layer(session, 0).id
    session.choose(layer(session, 0).id)
    session.remove()
    session.choose(layer(session, 1).id)
    session.wrap('⿱')
    expect(session.allocator.ids.has(removed)).toBe(true)
    expect(documentIds(session.document)).not.toContain(removed)
  })
  it('snapshots and restores the document and its history', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    session.choose(layer(session, 1).id)
    session.replace('水')
    const snapshot = session.snapshot()
    session.replace('火')
    expect(session.sequence).toBe('⿰木火')
    session.restore(snapshot)
    expect(session.sequence).toBe('⿰木水')
    expect(session.steps.done.length).toBe(1)
    expect(session.undo()).toBe(true)
    expect(session.sequence).toBe('⿰木口')
    expect(snapshot.ids.length).toBeGreaterThan(0)
  })
  it('iterates a snapshot when a listener unsubscribes another', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const calls = []
    let stopSecond = () => {}
    session.listen(() => { calls.push('first'); stopSecond() })
    stopSecond = session.listen(() => { calls.push('second') })
    session.choose(layer(session, 0).id)
    expect(calls).toEqual(['first', 'second'])
  })
  it('reports a listener error without failing the committed edit', () => {
    const errors = []
    const session = createDocumentSession(fromSequence('⿰木口'), { onListenerError: error => errors.push(error) })
    session.listen(() => { throw new Error('listener failed') })
    session.choose(layer(session, 0).id)
    expect(() => session.replace('水')).not.toThrow()
    expect(session.sequence).toBe('⿰水口')
    expect(session.canUndo).toBe(true)
    expect(errors).toHaveLength(2)
    expect((errors[1] instanceof Error ? errors[1].message : '')).toBe('listener failed')
  })
  it('notifies listeners on choice and edits, and stops on unlisten', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    let calls = 0
    const stop = session.listen(() => { calls++ })
    session.choose(layer(session, 0).id)
    session.replace('水')
    expect(calls).toBe(2)
    stop()
    session.replace('火')
    expect(calls).toBe(2)
  })
  it('resets to a new sequence, clearing history but keeping old IDs reserved', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const old = documentIds(session.document)
    session.choose(layer(session, 0).id)
    session.replace('水')
    session.reset('⿱水火')
    expect(session.sequence).toBe('⿱水火')
    expect(session.chosen).toBeNull()
    expect(session.canUndo).toBe(false)
    for (const id of old) expect(session.allocator.ids.has(id)).toBe(true)
  })
  it('clears a transform without changing the layer identity', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const target = layer(session, 0).id
    session.choose(target)
    session.setTransform(transform)
    session.clearTransform()
    expect(findLayer(session.document.root, target)?.node.transform).toBeUndefined()
    session.undo()
    expect(findLayer(session.document.root, target)?.node.transform).toEqual(transform)
  })
  it('opens a validated document and keeps every ID reserved', () => {
    const source = fromSequence('⿱木水')
    const session = createDocumentSession(fromSequence('⿰木口'))
    session.open(source)
    expect(session.sequence).toBe('⿱木水')
    expect(session.canUndo).toBe(false)
    for (const id of documentIds(source)) expect(session.allocator.ids.has(id)).toBe(true)
    expect(validateDocument(session.document)).toEqual([])
  })
})
