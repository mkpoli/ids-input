// Build `data/han-parts.json.gz`: every Han-script character the composer can draw, with the stroke
// count Unihan records for each. The export's records are sharded by hash, so those keys come from
// their stored entries; the bundled fallback outlines and the palette outlines add the characters the
// export lacks. Unicode alone would claim glyphs no source draws.
//
//   node scripts/build_han_parts.mjs [Unihan.zip]   # a local copy skips the download
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync, inflateRawSync } from 'node:zlib'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { characterScript } from '../src/core/scripts.js'

const UNIHAN = {
  url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
  sha256: '4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e',
}

/** One entry of a zip archive, inflated when stored deflated. */
function unzipEntry(archive, name) {
  const eocd = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw Error('Not a zip archive')
  const count = archive.readUInt16LE(eocd + 10), start = archive.readUInt32LE(eocd + 16)
  let at = start
  for (let index = 0; index < count; index++) {
    const method = archive.readUInt16LE(at + 10), size = archive.readUInt32LE(at + 20)
    const nameLength = archive.readUInt16LE(at + 28), extraLength = archive.readUInt16LE(at + 30), commentLength = archive.readUInt16LE(at + 32)
    const offset = archive.readUInt32LE(at + 42)
    if (archive.subarray(at + 46, at + 46 + nameLength).toString() === name) {
      const localName = archive.readUInt16LE(offset + 26), localExtra = archive.readUInt16LE(offset + 28)
      const data = archive.subarray(offset + 30 + localName + localExtra, offset + 30 + localName + localExtra + size)
      return method === 0 ? data : inflateRawSync(data)
    }
    at += 46 + nameLength + extraLength + commentLength
  }
  throw Error(`No ${name} in the archive`)
}

const root = COMPOSER_BASE, manifest = await (await fetch(root + 'manifest.json')).json()
if (manifest.format !== 5 || manifest.files.records.files !== 4096) throw Error('Unexpected composer export')
const keys = new Set(), errors = []; let next = 0, done = 0
async function worker() {
  while (next < 4096) {
    const shard = (next++).toString(16).padStart(3, '0')
    let rows
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${root}g/${shard}.json`)
        if (!response.ok) throw Error(`${response.status}`)
        rows = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())))
        break
      } catch (error) { if (attempt === 2) errors.push(`${shard}: ${error}`) }
    }
    for (const record of Object.values(rows ?? {})) {
      const key = record.k
      if (typeof key !== 'string' || !record.G && !record.s && !record.e) continue
      if ([...key].length === 1 && characterScript(key) === 'han') keys.add(key)
    }
    if (++done % 512 === 0) console.log(`${done}/4096 shards`)
  }
}
await Promise.all(Array.from({ length: 10 }, worker))
if (errors.length) throw Error(errors.join('\n'))

const archive = process.argv[2] ? readFileSync(process.argv[2]) : Buffer.from(await (await fetch(UNIHAN.url)).arrayBuffer())
if (createHash('sha256').update(archive).digest('hex') !== UNIHAN.sha256) throw Error(`Unexpected Unihan: ${UNIHAN.url}`)
const total = new Map()
for (const line of unzipEntry(archive, 'Unihan_IRGSources.txt').toString().split('\n')) {
  if (!line.startsWith('U+')) continue
  const [point, field, value] = line.split('\t')
  if (field === 'kTotalStrokes' && value) total.set(String.fromCodePoint(parseInt(point.slice(2), 16)), Number(value.split(' ')[0]))
}

// The bundled fallback outlines, then the palette's own fallback outlines, cover characters the
// export does not record; both are sources the composer draws from.
const coverage = JSON.parse(readFileSync(new URL('../data/unicode-coverage.json', import.meta.url)))
for (const [first, last] of coverage) {
  for (let point = first; point <= last; point++) {
    const char = String.fromCodePoint(point)
    if (characterScript(char) === 'han') keys.add(char)
  }
}
const palette = JSON.parse(gunzipSync(readFileSync(new URL('../data/palette-outlines.json.gz', import.meta.url)))).records
for (const char of Object.keys(palette)) {
  if ([...char].length === 1 && characterScript(char) === 'han') keys.add(char)
}

const list = [...keys].sort((a, b) => Number(a.codePointAt(0)) - Number(b.codePointAt(0)))
const strokes = list.map(key => total.get(key) ?? null)
const json = JSON.stringify({ base: root, commit: manifest.composer.commit, keys: list, strokes })
writeFileSync(new URL('../data/han-parts.json.gz', import.meta.url), gzipSync(json, { level: 9, mtime: 0 }))
console.log(`${list.length} Han characters, ${strokes.filter(count => count !== null).length} with stroke counts`)
