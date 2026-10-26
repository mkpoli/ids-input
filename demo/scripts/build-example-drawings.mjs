#!/usr/bin/env bun
// Rebuild demo/lib/example-drawings.json: every starter example composed once using bundled Tangut outlines or the export at
// COMPOSER_BASE, so the demo opens an example without waiting for the composer. Run it whenever
// COMPOSER_BASE changes; tests/example-drawings.test.js fails until the file matches the export.
//
//   bun run build:example-drawings
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hasTangut, onlyTangut, tangutSource } from '../../src/composer/tangut.js'
import { compose, fromUrl } from '../../src/composer/loader.js'
import { EXAMPLES } from '../lib/examples.js'
import { COMPOSER_BASE } from '../lib/composer.js'

const source = fromUrl(COMPOSER_BASE)
const loadTangut = async () => JSON.parse(gunzipSync(readFileSync(new URL('../../data/tangut-outlines.json.gz', import.meta.url))))
const tangut = tangutSource({ load: loadTangut })
const mixed = tangutSource({ load: loadTangut, fallback: source })
await source.ready()
const drawings = {}
const failed = []
for (const example of EXAMPLES) {
  try {
    const selected = onlyTangut(example.sequence) ? tangut : hasTangut(example.sequence) ? mixed : source
    const drawn = await compose(selected, example.sequence)
    drawings[example.sequence] = { char: example.char, drawn }
    console.log(`drew ${example.char || example.sequence}`)
  } catch (error) {
    failed.push({ sequence: example.sequence, char: example.char, name: error?.name, message: String(error?.message ?? error) })
    console.log(`skipped ${example.char || example.sequence}: ${error?.name ?? 'Error'}: ${error?.message ?? error}`)
  }
}
const manifest = source.manifest
const data = {
  base: COMPOSER_BASE,
  composer: {
    commit: manifest?.composer?.commit ?? null,
    style: manifest?.composer?.style ?? null,
    layout_sha256: manifest?.composer?.layout_sha256 ?? null,
  },
  drawings,
  failed,
}
const out = new URL('../lib/example-drawings.json', import.meta.url)
writeFileSync(out, JSON.stringify(data, null, 1) + '\n')
console.log(`${Object.keys(drawings).length} drawings, ${failed.length} skipped, ${JSON.stringify(data).length} bytes -> ${out.pathname}`)
