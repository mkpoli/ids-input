// Build `data/tangut-strokes.json.gz`: the nominal stroke count of each Tangut ideograph, from
// Unicode's kTGT_RSUnicode radical-stroke index, whose second value is the total stroke count.
import { writeFileSync } from 'node:fs'
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
const json = JSON.stringify({ source: SOURCE, values })
writeFileSync(new URL('../data/tangut-strokes.json.gz', import.meta.url), gzipSync(json, { level: 9, mtime: 0 }))
console.log(`${Object.keys(values).length} Tangut ideographs with a stroke count`)
