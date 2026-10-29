// Build `data/tangut-strokes.json.gz`: the nominal stroke count of each Tangut ideograph from
// Unicode's kTGT_RSUnicode radical-stroke index, whose second value is the total stroke count, and
// of each of the 768 Tangut components counted from their glyphs in `tangut-component-strokes.tsv`.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const SOURCE = 'https://www.unicode.org/Public/18.0.0/ucd/TangutSources.txt'
const SHA256 = 'ae440bd9bba89b2610cfe6b498ac462d2763dd32bfead8ac30d32988b5b67a27'
const bytes = Buffer.from(await (await fetch(SOURCE)).arrayBuffer())
if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw Error(`Unexpected Tangut sources: ${SOURCE}`)
/** @type {Record<string, number>} */
const values = {}
for (const line of bytes.toString().split('\n')) {
  const [point, tag, value] = line.split('\t')
  if (!point?.startsWith('U+') || tag !== 'kTGT_RSUnicode' || !value) continue
  const count = Number(value.split('.')[1])
  if (Number.isFinite(count)) values[String.fromCodePoint(parseInt(point.slice(2), 16))] = count
}
let components = 0
for (const line of readFileSync(new URL('../data/tangut-component-strokes.tsv', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [point, count] = line.split('\t')
  if (!point?.startsWith('U+')) continue
  const char = String.fromCodePoint(parseInt(point.slice(2), 16))
  if (values[char] !== undefined) throw Error(`Tangut component ${point} already has a count`)
  values[char] = Number(count)
  components++
}
const json = JSON.stringify({
  sources: { ideographs: SOURCE, components: 'Counted from the glyphs in review' },
  values,
})
writeFileSync(new URL('../data/tangut-strokes.json.gz', import.meta.url), gzipSync(json, { level: 9, mtime: 0 }))
console.log(`${Object.keys(values).length - components} Tangut ideographs and ${components} components with a stroke count`)
