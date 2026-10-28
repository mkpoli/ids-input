import { describe, expect, it } from 'bun:test'
import { fromSequence, toSequence } from '../src/document/index.js'
import { documentFile, documentName, readDocumentFile } from '../demo/lib/documents.js'

describe('document files', () => {
  it('names a file after the sequence without path characters', () => {
    expect(documentName('⿰木口')).toBe('⿰木口.ids.json')
    expect(documentName('a/b\\c:d')).toBe('abcd.ids.json')
    expect(documentName('')).toBe('ids.ids.json')
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
