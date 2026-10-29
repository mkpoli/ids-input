import { describe, expect, it } from 'bun:test'
import { fromSequence, toSequence } from '../src/document/index.js'
import { documentFile, documentName, embedSvgDocument, readDocumentFile, readSvgDocument } from '../demo/lib/documents.js'

describe('document files', () => {
  it('names a file after the sequence without path characters', () => {
    expect(documentName('⿰木口')).toBe('⿰木口.ids.json')
    expect(documentName('a/b\\c:d')).toBe('abcd.ids.json')
    expect(documentName('')).toBe('ids.ids.json')
  })
  it('does not split a surrogate pair when shortening a name', () => {
    const stem = documentName('𠀀'.repeat(50)).replace('.ids.json', '')
    expect([...stem]).toHaveLength(40)
    expect(stem).toBe('𠀀'.repeat(40))
  })
  it('round-trips a document through SVG metadata', async () => {
    const document = fromSequence('⿱木口')
    document.title = 'SVG & <title>'
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }]
    const svg = embedSvgDocument('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0Z"/></svg>', document)
    expect(svg).toContain('id="ids-input-document"')
    expect(readSvgDocument(svg).title).toBe('SVG & <title>')
    expect((await readDocumentFile(new File([svg], 'drawing.svg', { type: 'image/svg+xml' }))).root.children[0].transform).toEqual([{ type: 'affine', matrix: [1, 0, 0, 1, 9, 0] }])
  })
  it('rejects an SVG without a document', () => {
    expect(() => readSvgDocument('<svg></svg>')).toThrow()
  })
  it('writes and reads a document file', async () => {
    const document = fromSequence('⿱木口')
    document.title = 'Example'
    const file = documentFile(document, '⿱木口')
    expect(file.type).toStartWith('application/json')
    const read = await readDocumentFile(file)
    expect(read.title).toBe('Example')
    expect(toSequence(read.root)).toBe('⿱木口')
  })
  it('rejects a file that is not a document', async () => {
    await expect(readDocumentFile(new File(['{}'], 'bad.ids.json', { type: 'application/json' }))).rejects.toThrow()
  })
})
