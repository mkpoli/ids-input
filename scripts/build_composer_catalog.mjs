// Index keys in the pinned default composer export. Records are sharded by hash, so enumerate
// their stored keys rather than trying to infer them from Unicode or from the parts palette.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { parse } from '../src/core/ids.js'

const root = COMPOSER_BASE, manifest = await (await fetch(root + 'manifest.json')).json()
if (manifest.format !== 5 || manifest.files.records.files !== 4096) throw Error('Unexpected composer export')
const records = new Set(), errors = []; let next = 0, done = 0
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
      const result = parse(key, { open: true })
      if (!result.problem && result.tree !== null) records.add(key)
    }
    if (++done % 512 === 0) console.log(`${done}/4096 shards`)
  }
}
await Promise.all(Array.from({ length: 10 }, worker))
if (errors.length) throw Error(errors.join('\n'))
// These glyphs are bundled outside the Han export and include more than the palette's parts.
for (const name of ['tangut-outlines', 'small-seal-outlines', 'bopomofo-outlines']) {
  const data = JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))
  for (const key of Object.keys(data.records)) records.add(key)
}
const forms = JSON.parse(readFileSync(new URL('../src/composer/component-forms.json', import.meta.url)))
for (const style of Object.values(forms.forms)) for (const key of Object.keys(style)) records.add(key)
const keys = [...records].sort((a, b) => a.codePointAt(0) - b.codePointAt(0) || a.localeCompare(b, 'en'))
const json = JSON.stringify({ base: root, commit: manifest.composer.commit, keys })
writeFileSync(new URL('../data/composer-catalog.json.gz', import.meta.url), gzipSync(json, { level: 9, mtime: 0 }))
console.log(`${keys.length} keys`)
