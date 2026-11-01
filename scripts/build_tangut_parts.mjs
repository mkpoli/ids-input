// Keep the palette index in sync with the bundled Tangut outline source.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
const path = name => new URL(`../data/${name}`, import.meta.url)
// The outlines are the drawing engine's; the index of their keys is this package's palette.
const { records } = JSON.parse(gunzipSync(readFileSync(new URL('../node_modules/@han-compose/composer/data/sources/tangut/outlines.json.gz', import.meta.url))))
writeFileSync(path('tangut-parts.json.gz'), gzipSync(JSON.stringify(Object.keys(records)), { level: 9, mtime: 0 }))
