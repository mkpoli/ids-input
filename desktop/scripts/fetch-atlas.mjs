// Copies the sans composer export the workshop draws from (COMPOSER_BASE) into desktop/atlas/, which
// the app bundles and serves under its `atlas` scheme. The copy is kept per export: a folder that
// already holds this export gains only the files it lacks.
//
//   bun desktop/scripts/fetch-atlas.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { COMPOSER_BASE } from '../../demo/lib/composer.js'

const OUT = join(import.meta.dirname, '..', 'atlas')
const WORKERS = 32, TRIES = 5
// A shard is named by the first hex digits of its keys' hash: four for a record shard, which sits in
// a folder of the first two, and three for a host-list shard.
const hex = (count, digits) => Array.from({ length: count }, (_, i) => i.toString(16).padStart(digits, '0'))
const RECORDS = hex(65536, 4).map(shard => `g/${shard.slice(0, 2)}/${shard}.json`)
const HOSTS = hex(4096, 3).map(shard => `p/${shard}.json`)

/** @param {string} name @returns {Promise<Uint8Array | null>} null where the export has no such shard */
async function get(name) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(new URL(name, COMPOSER_BASE), { headers: { 'user-agent': 'ids-workshop-desktop-build' } })
      if (response.status === 404 && /^[gp]\//.test(name)) return null
      if (!response.ok) throw new Error(`${name}: ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      if (attempt >= TRIES) throw error
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
}

// The folder names the export it holds; a folder of another export, or of none, starts over.
const marker = join(OUT, 'export.txt')
if (existsSync(OUT) && (!existsSync(marker) || readFileSync(marker, 'utf8') !== COMPOSER_BASE)) {
  console.log('desktop/atlas holds another export; starting over')
  rmSync(OUT, { recursive: true, force: true })
}
mkdirSync(OUT, { recursive: true })
writeFileSync(marker, COMPOSER_BASE)

const manifestBytes = /** @type {Uint8Array} */ (await get('manifest.json'))
const manifest = JSON.parse(new TextDecoder().decode(manifestBytes))

const names = [
  manifest.files.layout.path,
  manifest.files.identity.path,
  ...manifest.files.licences,
  ...RECORDS,
  ...HOSTS,
]
const missing = names.filter(name => !existsSync(join(OUT, name)) && !existsSync(join(OUT, `${name}.absent`)))
console.log(`${COMPOSER_BASE}\n${names.length} files, ${missing.length} to fetch`)

let done = 0, absent = 0
const queue = [...missing]
await Promise.all(Array.from({ length: WORKERS }, async () => {
  for (let name; (name = queue.shift());) {
    const bytes = await get(name)
    const path = join(OUT, name)
    mkdirSync(dirname(path), { recursive: true })
    // A shard the export never wrote is remembered, so a second run does not ask again; the app
    // answers 404 for it as the site does.
    if (bytes) writeFileSync(path, bytes)
    else { writeFileSync(`${path}.absent`, ''); absent++ }
    if (++done % 4000 === 0) console.log(`${done}/${missing.length}`)
  }
}))
// The manifest goes last, so an interrupted run is never taken for a complete one.
writeFileSync(join(OUT, 'manifest.json'), manifestBytes)
console.log(`fetched ${done - absent}, ${absent} shards absent from the export`)
