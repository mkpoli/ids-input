import { describe, expect, it } from 'bun:test'
import { parse } from '../src/core/ids.js'
import { findLayer, toSequence } from '../src/document/index.js'
import { openTabSession, syncTabSession } from '../demo/lib/document-state.js'

const tab = sequence => ({ id: 'tab', sequence, saved: sequence, whole: sequence })
const tree = sequence => parse(sequence, { open: true }).tree

describe('a tab document session', () => {
  it('starts from the tab sequence', () => {
    const session = openTabSession(tab('⿰木口'))
    expect(session.sequence).toBe('⿰木口')
  })
  it('reconciles the editor tree and keeps the layer through replacement', () => {
    const session = openTabSession(tab('⿰木口'))
    const left = session.document.root.children[0]
    session.choose(left.id)
    session.setTransform([{ type: 'affine', matrix: [1, 0, 0, 1, 6, 7] }])
    const record = syncTabSession(session, tree('⿰水口'))
    expect(toSequence(record.document.root)).toBe('⿰水口')
    expect(findLayer(record.document.root, left.id)?.node).toMatchObject({ char: '水', transform: [{ type: 'affine', matrix: [1, 0, 0, 1, 6, 7] }] })
  })
  it('reopens the record with its chosen layer and IDs', () => {
    const session = openTabSession(tab('⿰木口'))
    const chosen = session.document.root.children[0].id
    session.choose(chosen)
    const stored = { ...tab('⿰木口'), document: syncTabSession(session, tree('⿰木口')) }
    const read = openTabSession(stored)
    expect(read.chosen).toBe(chosen)
    expect(findLayer(read.document.root, chosen)).not.toBeNull()
  })
  it('falls back to an empty document for a malformed record or draft', () => {
    const malformed = { ...tab('⿰木口'), document: { format: 'ids-input/session', version: 1, document: {}, chosen: null, ids: [] } }
    expect(openTabSession(malformed).sequence).toBe('⿰木口')
    const draft = openTabSession(tab('⿰木木木'))
    expect(draft.sequence).toBe('⬚')
  })
})
