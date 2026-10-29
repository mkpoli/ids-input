// Document files in the workshop: a name safe for a download, and reading a chosen file through the
// format's own validator.
import { readDocument, writeDocument } from '../../src/document/index.js'
import { fileStem } from './files.js'
import { readPngDocument } from './png-document.js'

/** @param {string} value */
const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** @param {string} value */
const unescapeXml = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Put the editable document in an SVG's metadata so the export can be reopened.
 * @param {string} svg @param {import('../../src/document/index.js').Document | null} document */
export function embedSvgDocument(svg, document) {
  if (!document || !svg.includes('</svg>')) return svg
  const metadata = `<metadata id="ids-input-document">${escapeXml(JSON.stringify(document))}</metadata>`
  return svg.replace('</svg>', `${metadata}</svg>`)
}

/** Read the document embedded in an SVG. @param {string} svg @returns {import('../../src/document/index.js').Document} */
export function readSvgDocument(svg) {
  const match = /<metadata\b[^>]*\bid="ids-input-document"[^>]*>([\s\S]*?)<\/metadata>/i.exec(svg)
  if (!match) throw new Error('the SVG has no editable document')
  return readDocument(unescapeXml(match[1]))
}

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
  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml') return readSvgDocument(text)
  if (file.name.toLowerCase().endsWith('.png') || file.type === 'image/png') return readPngDocument(await file.arrayBuffer())
  return readDocument(text)
}
