// A small composer export built in memory: `composer-constants.json` holds han-compose's drawing
// constants (`compose.py` at bd0829b, with the stems and face the font gives), and a few characters
// are boxes. The layout network is all zeros, so two-operand nodes fall back to the composer's shares.
// The tests draw from it, and the demo's browser check serves it in place of a real export.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

export const constants = JSON.parse(readFileSync(join(import.meta.dirname, 'composer-constants.json'), 'utf8'))
const hex = text => createHash('sha256').update(text).digest('hex')
export const at = (folder, text) => `${folder}/${hex(text).slice(0, 2)}/${hex(text)}.json`
const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
// A glyph of boxes, each [x0, y0, x1, y1] in font units: one square contour per box.
const glyph = boxes => {
  const b = [Math.min(...boxes.map(x => x[0])), Math.min(...boxes.map(x => x[1])), Math.max(...boxes.map(x => x[2])), Math.max(...boxes.map(x => x[3]))]
  return { v: 1, b, p: boxes.map(([x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]) }
}
const character = (key, boxes) => ({ k: key, G: glyph(boxes), ink: boxes.reduce((s, [x0, y0, x1, y1]) => s + 2 * (x1 - x0 + y1 - y0), 0), nl: boxes.length, o: boxes.length })
export const ops = ['⿰', '⿱', '⿸', '⿺', '⿵', '⿹', '⿶', '⿴', '⿷']
export const layout = { ops, defaults: Object.fromEntries(['L', 'R', 'T', 'B', ...ops.slice(2).flatMap(op => [`${op}0`, `${op}1`])].map(p => [p, [0, 0, 1000, 1000]])),
  features: {}, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') }, Buffer.alloc(32).toString('base64')]] }
const records = {
  木: character('木', [[100, -60, 900, 0], [470, -80, 530, 820]]),
  口: character('口', [[120, -40, 880, 20], [120, 700, 880, 760], [120, -40, 180, 760], [820, -40, 880, 760]]),
  永: character('永', [[100, 0, 900, 800]]),
}
/** Each file of the export by its name: JSON text, or gzip bytes for a record. */
export const files = {
  'manifest.json': JSON.stringify({ format: 2, files: { layout: { path: 'layout.json' } }, constants, spelled: [] }),
  'layout.json': JSON.stringify(layout),
  ...Object.fromEntries(Object.entries(records).map(([key, record]) => [at('g', key), gzipSync(JSON.stringify(record))])),
}
