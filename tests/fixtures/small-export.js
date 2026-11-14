// A small export built in memory, as an `export-web` folder would hold one: the engine's drawing
// constants, a manifest, a zeroed layout (so two parts share their box evenly), and a few characters
// drawn as boxes. Tests that need an export rather than a real one draw from it.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const ENGINE = join(import.meta.dirname, '../../node_modules/@han-compose/composer')
export const constants = JSON.parse(readFileSync(join(ENGINE, 'src/constants.json'), 'utf8'))
const hex = text => createHash('sha256').update(text).digest('hex')
/** The shard a key's record or host list is in: named by the first hex digits of its SHA-256, four
 *  for a record and three for a host list. */
export const shardOf = (folder, text) => {
  const h = hex(text)
  return folder === 'g' ? `g/${h.slice(0, 2)}/${h.slice(0, 4)}.json` : `p/${h.slice(0, 3)}.json`
}
/** The identity table of `entries` (`[key, record]`): each character's sequence, and what each
 *  sequence describes where that is not the character listed with it. */
export const identityOf = entries => {
  const written = entries.filter(([, record]) => record.s !== undefined)
  const implied = new Map(written.map(([key, record]) => [record.s, key]))
  const e = Object.fromEntries(entries.filter(([key, record]) => record.e !== undefined && implied.get(key) !== record.e).map(([key, record]) => [key, record.e]))
  for (const [sequence] of implied) if (!entries.some(([key, record]) => key === sequence && record.e !== undefined)) e[sequence] = null
  return JSON.stringify({ characters: written.map(([key]) => key).join('\n'), sequences: written.map(([, record]) => record.s).join('\n'), e })
}
/** The export's shards: each entry under its text (a key, or place TAB operand), gzipped. The
 *  records' shards come with the identity table of those records. */
export const shards = (folder, entries) => {
  const out = {}
  for (const [text, value] of entries) ((out[shardOf(folder, text)] ??= {})[text] = value)
  return { ...Object.fromEntries(Object.entries(out).map(([name, file]) => [name, gzipSync(JSON.stringify(file))])),
    ...(folder === 'g' ? { 'identity.json': identityOf(entries) } : {}) }
}
const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
// A glyph of boxes, each [x0, y0, x1, y1] in font units: one square contour per box.
const glyph = boxes => {
  const b = [Math.min(...boxes.map(x => x[0])), Math.min(...boxes.map(x => x[1])), Math.max(...boxes.map(x => x[2])), Math.max(...boxes.map(x => x[3]))]
  return { v: 1, b, p: boxes.map(([x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]) }
}
const character = (key, boxes) => ({ G: glyph(boxes), ink: boxes.reduce((s, [x0, y0, x1, y1]) => s + 2 * (x1 - x0 + y1 - y0), 0), nl: boxes.length, o: boxes.length })
export const ops = ['⿰', '⿱', '⿸', '⿺', '⿵', '⿹', '⿶', '⿴', '⿷']
export const layout = { ops, defaults: Object.fromEntries(['L', 'R', 'T', 'B', ...ops.slice(2).flatMap(op => [`${op}0`, `${op}1`])].map(p => [p, [0, 0, 1000, 1000]])),
  features: {}, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') }, Buffer.alloc(32).toString('base64')]] }
const records = {
  木: character('木', [[100, -60, 900, 0], [470, -80, 530, 820]]),
  口: character('口', [[120, -40, 880, 20], [120, 700, 880, 760], [120, -40, 180, 760], [820, -40, 880, 760]]),
  永: character('永', [[100, 0, 900, 800]]),
}
/** Each file of the export by its name: JSON text, or gzip bytes for a shard. */
export const files = {
  'manifest.json': JSON.stringify({ format: 7, files: { layout: { path: 'layout.json' }, identity: { path: 'identity.json' } }, constants, spelled: [] }),
  'layout.json': JSON.stringify(layout),
  ...shards('g', Object.entries(records)),
}

/**
 * The same export, hosted or not: `bytes` the host lists it says it carries, `places` the places its
 * records name a host list for (`P`). An export names hosts per record, so a node whose operand has
 * no list in its place takes the plain shares.
 * @param {{ bytes?: number, places?: string[] }} [options]
 */
export function hosted({ bytes = 1, places = ['L', 'R'] } = {}) {
  const named = Object.fromEntries(Object.entries(records).map(([key, record]) => [key, { ...record, P: places }]))
  const manifest = JSON.parse(files['manifest.json'])
  // A record that names its places has a host list in `p/` for each; these carry none, so the parts
  // take the learned boxes and no cut.
  const lists = Object.keys(records).flatMap(key => places.map(place => [`${place}\t${key}`, []]))
  return {
    ...files,
    'manifest.json': JSON.stringify({ ...manifest, files: { ...manifest.files, hosts: { bytes } } }),
    ...shards('g', Object.entries(named)),
    ...(bytes ? shards('p', lists) : {}),
  }
}
