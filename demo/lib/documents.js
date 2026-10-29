// Document files in the workshop: a name safe for a download, and reading a chosen file through the
// format's own validator.
import { readDocument, writeDocument } from '../../src/document/index.js'
import { fileStem } from './files.js'

/** A file name for `sequence`, without path separators or controls. @param {string} sequence */
export function documentName(sequence) {
  return `${fileStem(sequence)}.ids.json`
}

/** @param {import('../../src/document/index.js').Document} document @param {string} sequence */
export function documentFile(document, sequence) {
  return new File([writeDocument(document)], documentName(sequence), { type: 'application/json' })
}

/** @param {File} file @returns {Promise<import('../../src/document/index.js').Document>} */
export async function readDocumentFile(file) {
  return readDocument(await file.text())
}
