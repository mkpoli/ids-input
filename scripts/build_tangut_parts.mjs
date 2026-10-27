// Keep the palette index in sync with the bundled Tangut outline source.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
const path = name => new URL(`../data/${name}`, import.meta.url)
const { records } = JSON.parse(gunzipSync(readFileSync(path('tangut-outlines.json.gz'))))
writeFileSync(path('tangut-parts.json.gz'), gzipSync(JSON.stringify(Object.keys(records)), { level: 9, mtime: 0 }))
