// Index bundled Small Seal descriptions absent from the curated component list.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))
// The outlines are the engine's, read where the package holds them.
const engine = new URL('../node_modules/@han-compose/composer/data/sources/small-seal/outlines.json.gz', import.meta.url)
const parts = new Set(data('small-seal').parts.map(part => part.part))
const extra = Object.keys(JSON.parse(gunzipSync(readFileSync(engine))).records).filter(key => !parts.has(key))
writeFileSync(new URL('../data/seal-extra-parts.json', import.meta.url), `${JSON.stringify(extra)}\n`)
