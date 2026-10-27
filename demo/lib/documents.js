// Document files in the workshop: a name safe for a download, and reading a chosen file through the
// format's own validator.
import { readDocument, writeDocument } from '../../src/document/index.js'

/** A file name for `sequence`, without path separators or controls. @param {string} sequence */
export function documentName(sequence) {
  const stem = [...sequence].filter(char => !/[\u0000-\u001f\u007f/\\:*?"<>|]/.test(char)).join('').slice(0, 40)
  return `${stem || 'ids'}.ids.json`
}

/** @param {import('../../src/document/index.js').Document} document @param {string} sequence */
export function documentFile(document, sequence) {
  return new File([writeDocument(document)], documentName(sequence), { type: 'application/json' })
}

/** @param {File} file @returns {Promise<import('../../src/document/index.js').Document>} */
export async function readDocumentFile(file) {
  return readDocument(await file.text())
}
