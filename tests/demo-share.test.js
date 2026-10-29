import { describe, expect, it } from 'bun:test'
import { fromSequence } from '../src/document/index.js'
import { documentFrom, linkTo, sequenceFrom } from '../demo/lib/share.js'

describe('share links', () => {
  it('puts a complete document and its sequence in a link', () => {
    const document = fromSequence('⿰木口')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }]
    const url = new URL(linkTo('⿰木口', new URL('https://example.org/'), document))
    expect(sequenceFrom(url)).toBe('⿰木口')
    expect(documentFrom(url)?.root.children[0].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }])
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
})
