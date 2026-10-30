import { describe, expect, it } from 'bun:test'
import { fromSequence } from '../src/document/index.js'
import { addressDocument, documentFrom, linkTo, sequenceFrom } from '../demo/lib/share.js'

describe('share links', () => {
  it('puts a document and its sequence in a link', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }]
    const url = new URL(linkTo('⿰木口', new URL('https://example.org/'), document))
    expect(sequenceFrom(url)).toBe('⿰木口')
    expect(documentFrom(url)?.root.children[0].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }])
  })
  it('leaves the fragment to say it all for a document nothing was done to', () => {
    const url = new URL(linkTo('⿺电尼', new URL('https://example.org/'), fromSequence('⿺电尼')))
    expect(url.searchParams.has('doc')).toBe(false)
    expect(url.href).toBe('https://example.org/#%E2%BF%BA%E7%94%B5%E5%B0%BC')
  })
  it('removes a document token when none is given', () => {
    const url = new URL('https://example.org/?doc=abc#%E2%BF%B0')
    const clean = new URL(linkTo('⿰', url))
    expect(clean.searchParams.has('doc')).toBe(false)
    expect(sequenceFrom(clean)).toBe('⿰')
  })
  it('reads a malformed token as no document', () => {
    expect(documentFrom(new URL('https://example.org/?doc=abc'))).toBeNull()
  })
  it('keeps the address bar plain until the document holds more than its sequence', () => {
    const document = fromSequence('⿰木口')
    expect(addressDocument(document)).toBeNull()
    document.title = 'Titled'
    expect(addressDocument(document)).toBe(document)
    const transformed = fromSequence('⿰木口')
    transformed.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }]
    expect(addressDocument(transformed)).toBe(transformed)
    const group = fromSequence('木')
    group.root = { id: 'g', kind: 'group', child: group.root }
    expect(addressDocument(group)).toBe(group)
  })
})
