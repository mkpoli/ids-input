// A PNG may carry one iTXt chunk with the editable document. The chunk is uncompressed UTF-8,
// inserted before IEND, so ordinary viewers ignore it and the workshop can reopen the PNG.
import { readDocument } from '../../src/document/index.js'

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const KEYWORD = 'ids-input'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const table = (() => {
  const values = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    values[n] = c >>> 0
  }
  return values
})()

/** @param {Uint8Array} bytes */
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** @param {string} type @param {Uint8Array} data */
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(encoder.encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** @param {Uint8Array[]} parts */
function join(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) { out.set(part, at); at += part.length }
  return out
}

/** @param {ArrayBuffer | Uint8Array} input @returns {{ type: string, data: Uint8Array, raw: Uint8Array }[]} */
function chunks(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length < 8 || SIGNATURE.some((byte, i) => bytes[i] !== byte)) throw new Error('not a PNG')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = []
  for (let at = 8; at + 12 <= bytes.length;) {
    const length = view.getUint32(at)
    if (at + 12 + length > bytes.length) throw new Error('truncated PNG')
    const type = decoder.decode(bytes.subarray(at + 4, at + 8))
    out.push({ type, data: bytes.subarray(at + 8, at + 8 + length), raw: bytes.subarray(at, at + 12 + length) })
    at += 12 + length
    if (type === 'IEND') break
  }
  if (!out.some(item => item.type === 'IEND')) throw new Error('PNG has no IEND')
  return out
}

/** Put the editable document in a PNG iTXt chunk. Existing workshop chunks are replaced.
 * @param {ArrayBuffer | Uint8Array} input @param {import('../../src/document/index.js').Document} document
 * @returns {Uint8Array} */
export function embedPngDocument(input, document) {
  const parts = [SIGNATURE]
  const text = encoder.encode(JSON.stringify(document))
  const data = new Uint8Array(KEYWORD.length + 5 + text.length)
  data.set(encoder.encode(KEYWORD), 0)
  data.set([0, 0, 0, 0, 0], KEYWORD.length)
  data.set(text, KEYWORD.length + 5)
  const textChunk = chunk('iTXt', data)
  for (const item of chunks(input)) {
    if (item.type === 'iTXt' && item.data[0] !== undefined && decoder.decode(item.data.subarray(0, item.data.indexOf(0))) === KEYWORD) continue
    if (item.type === 'IEND') parts.push(textChunk)
    parts.push(item.raw)
  }
  return join(parts)
}

/** Read the editable document from a PNG. @param {ArrayBuffer | Uint8Array} input @returns {import('../../src/document/index.js').Document} */
export function readPngDocument(input) {
  for (const item of chunks(input)) {
    if (item.type !== 'iTXt') continue
    const end = item.data.indexOf(0)
    if (end < 0 || decoder.decode(item.data.subarray(0, end)) !== KEYWORD) continue
    let at = end + 1
    const compression = item.data[at++], method = item.data[at++]
    if (compression !== 0 || method !== 0) throw new Error('compressed PNG documents are not supported')
    at = item.data.indexOf(0, at) + 1
    at = item.data.indexOf(0, at) + 1
    if (at <= 0) throw new Error('malformed PNG document')
    return readDocument(decoder.decode(item.data.subarray(at)))
  }
  throw new Error('the PNG has no editable document')
}
