#!/usr/bin/env bun
// A description for every variation sequence of an ideograph: the sequences of the Ideographic
// Variation Database and the standardized ones of the CJK compatibility ideographs, each described
// from the glyph GlyphWiki registers for it (`scripts/lib/variant-descriptions.mjs`).
//
//   bun scripts/build_variant_descriptions.mjs --ivd IVD_Sequences.txt \
//     --standardized StandardizedVariants.txt --dump <folder of GlyphWiki's dump>
//
// The folder holds `dump_newest_only.txt` of https://glyphwiki.org/dump.tar.gz.
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createDescriber, glyphName, rowsOf } from './lib/variant-descriptions.mjs'

const { values } = parseArgs({ options: { ivd: { type: 'string' }, standardized: { type: 'string' }, dump: { type: 'string' }, out: { type: 'string' } } })
for (const flag of ['ivd', 'standardized', 'dump']) if (!values[/** @type {'ivd'} */ (flag)]) throw Error(`Missing --${flag}`)
const data = (/** @type {string} */ name) => new URL(`../data/${name}`, import.meta.url)
const sha256 = (/** @type {Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex')

// The sequences, in the registry's order, then the standardized ones.
const ivd = await readFile(/** @type {string} */ (values.ivd))
const standardized = await readFile(/** @type {string} */ (values.standardized))
const sequence = (/** @type {string} */ points) => points.trim().split(/\s+/).map(point => String.fromCodePoint(parseInt(point, 16))).join('')
/** @type {Map<string, string[]>} Each sequence with what registers it. */
const sequences = new Map()
for (const line of ivd.toString('utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue
  const [points, collection, id] = line.split(';').map(field => field.trim())
  const written = sequence(points)
  sequences.set(written, [...sequences.get(written) ?? [], `${collection}:${id}`])
}
const registered = sequences.size
/** @type {Map<string, string>} Each compatibility ideograph's standardized sequence. */
const compatibility = new Map()
for (const line of standardized.toString('utf8').split('\n')) {
  const [points, description] = line.split(';').map(field => field.trim())
  if (line.startsWith('#') || !description?.startsWith('CJK COMPATIBILITY IDEOGRAPH-')) continue
  sequences.set(sequence(points), [`Unicode:U+${description.slice(28)}`])
  compatibility.set(String.fromCodePoint(parseInt(description.slice(28), 16)), sequence(points))
}

// GlyphWiki's rows for the sequences and for every glyph they place, read in passes over the dump.
const dump = join(/** @type {string} */ (values.dump), 'dump_newest_only.txt')
/** @type {Map<string, { related: string, data: string }>} */
const glyphs = new Map()
// Each character's plain glyph and its glyphs for a place in a character come with them: a
// component's form is told against those.
const PLAIN = /^u[0-9a-f]{4,6}(?:-\d{2})?$/
let wanted = new Set([...sequences.keys()].map(glyphName))
for (let pass = 0; wanted.size || !pass; pass++) {
  /** @type {Set<string>} */ const next = new Set()
  for await (const line of createInterface({ input: createReadStream(dump), crlfDelay: Infinity })) {
    const [name, related, row] = line.split('|').map(field => field.trim())
    if (row === undefined || glyphs.has(name) || !wanted.has(name) && (pass || !PLAIN.test(name))) continue
    glyphs.set(name, { related, data: row })
    for (const { name: inner } of rowsOf(row).placed) if (!glyphs.has(inner) && !wanted.has(inner)) next.add(inner)
  }
  wanted = next
}

// The characters' descriptions: BabelStone's with the sources each describes, then Yi Bai's.
/** @type {Map<string, { text: string, sources: string }[]>} */
const tables = new Map()
for (const name of ['babelstone-ids.tsv.gz', 'yi-bai-ids.tsv.gz']) {
  for (const line of gunzipSync(await readFile(data(name))).toString('utf8').split('\n')) {
    const [char, written] = line.split('\t')
    if (!written || line.startsWith('#')) continue
    const held = tables.get(char) ?? []
    for (const entry of written.split(' ').filter(Boolean)) {
      const [, text, sources = ''] = /^(.*?)(?:\(([^)]*)\))?$/.exec(entry) ?? []
      if (text && !held.some(found => found.text === text)) held.push({ text, sources })
    }
    tables.set(char, held)
  }
}
/** @param {string} char @param {string} [source] */
const descriptionsOf = (char, source) => {
  const held = tables.get(char) ?? []
  return (source ? [...held.filter(found => found.sources.includes(source)), ...held.filter(found => !found.sources.includes(source))] : held).map(found => found.text)
}
const ucv = JSON.parse(await readFile(data('ucv.json'), 'utf8'))
const describe = createDescriber(glyphs, descriptionsOf, ucv, compatibility)

/** @type {Record<string, number>} */
const counts = {}
const rows = []
for (const [written] of sequences) {
  const found = describe(written)
  if (!found) { counts.unregistered = (counts.unregistered ?? 0) + 1; continue }
  counts[found.how] = (counts[found.how] ?? 0) + 1
  rows.push([written, found.description, found.how, found.glyph].join('\t'))
}
const modified = (await stat(dump)).mtime.toISOString().slice(0, 10)
const header = [
  `# Descriptions of variation sequences: ${registered} of the Ideographic Variation Database and ${sequences.size - registered} standardized ones of CJK compatibility ideographs.`,
  `# IVD_Sequences.txt sha256:${sha256(ivd)}; StandardizedVariants.txt sha256:${sha256(standardized)}; GlyphWiki dump_newest_only.txt of ${modified}.`,
  '# sequence<TAB>description<TAB>how<TAB>glyph. how: named, composed, placed (the description is the sequence\'s own); drawn (the character\'s, since the glyph is drawn from strokes).',
]
const out = values.out ?? data('variant-descriptions.tsv.gz')
await writeFile(out, gzipSync([...header, ...rows].join('\n') + '\n', { level: 9 }))
console.log(JSON.stringify({ sequences: sequences.size, glyphs: glyphs.size, ...counts }))
