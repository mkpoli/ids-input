// Exercise the preview worker for every accepted non-private scalar.
// bun scripts/audit_render_coverage.mjs CACHE_DIR OUTPUT_JSON [sans|serif|klee]
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { isComponent } from '../src/core/ids.js'
import { UNICODE_VERSION } from '../src/core/unicode.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

const [cacheArg, output, style = 'sans'] = process.argv.slice(2)
if (!cacheArg || !output || !COMPOSER_BASES[style]) throw Error('Usage: bun scripts/audit_render_coverage.mjs CACHE_DIR OUTPUT_JSON [sans|serif|klee]')
const base = COMPOSER_BASES[style], cache = resolve(cacheArg)
await mkdir(cache, { recursive: true })
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const network = globalThis.fetch
const fetched = new Map(), local = new Map()
globalThis.fetch = async input => {
  const url = String(input)
  if (url.startsWith('file:')) {
    const bytes = await readFile(fileURLToPath(url))
    local.set(url.split('/data/')[1], digest(bytes))
    return new Response(bytes)
  }
  if (!url.startsWith(base)) throw Error(`Unexpected remote source: ${url}`)
  const path = `${cache}/${digest(url)}`
  let bytes
  try {
    await readFile(`${path}.404`)
    fetched.set(url.slice(base.length), null)
    return new Response(null, { status: 404 })
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  try { bytes = await readFile(path) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await network(url, { signal: AbortSignal.timeout(30000) })
        if (response.status === 404 && /\/[gp]\/[a-f0-9]{3}\.json$/.test(url)) {
          await writeFile(`${path}.404`, '')
          fetched.set(url.slice(base.length), null)
          return new Response(null, { status: 404 })
        }
        if (!response.ok) throw Error(`HTTP ${response.status}`)
        bytes = Buffer.from(await response.arrayBuffer())
        await writeFile(`${path}.tmp`, bytes)
        await rename(`${path}.tmp`, path)
        break
      } catch (error) { if (attempt === 2) throw Error(`${url}: ${error.message}`) }
    }
  }
  fetched.set(url.slice(base.length), digest(bytes))
  return new Response(bytes)
}
// Preload the finite record shard space with four requests in flight. The worker uses the cache.
const queue = Array.from({ length: 4096 }, (_, i) => `g/${i.toString(16).padStart(3, '0')}.json`)
let downloaded = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const name = queue.pop()
    if (!name) return
    await fetch(base + name)
    if (++downloaded % 512 === 0) console.log(`${style}: cached ${downloaded}/4096 record shards`)
  }
}))
let messages = []
globalThis.self = { postMessage: message => messages.push(message) }
await import('../src/composer/worker.js')
const ranges = points => {
  const rows = []
  for (const cp of points) {
    const last = rows.at(-1)
    if (last && cp === last[1] + 1) last[1] = cp
    else rows.push([cp, cp])
  }
  return rows
}
const privateUse = cp => cp >= 0xE000 && cp <= 0xF8FF || cp >= 0xF0000 && cp <= 0xFFFFD || cp >= 0x100000 && cp <= 0x10FFFD
const missing = [], invalid = [], failures = {}, accepted = [], drawn = []
let privateCount = 0
for (let cp = 0; cp <= 0x10FFFF; cp++) {
  const char = String.fromCodePoint(cp)
  if (!isComponent(char)) continue
  if (privateUse(cp)) { privateCount++; continue }
  accepted.push(cp)
  messages = []
  await self.onmessage({ data: { id: cp, sequence: char, base, separate: true, fontStyle: style === 'klee' ? 'kaisho' : style } })
  const answer = messages.at(-1)
  if (answer?.unavailable) throw Error(`Source unavailable at U+${cp.toString(16)}: ${answer.error}`)
  if (answer?.drawn) {
    const { d, parts } = answer.drawn
    if (d && !/NaN|Infinity/.test(d) && parts.length && parts.every(p => p.d && p.box.every(Number.isFinite))) drawn.push(cp)
    else invalid.push(cp)
  } else {
    // Transport errors must not be reported as glyph gaps.
    if (!answer?.error?.startsWith('No glyph')) throw Error(`Unexpected failure at U+${cp.toString(16)}: ${answer?.error}`)
    missing.push(cp)
    failures[answer.error] = (failures[answer.error] ?? 0) + 1
  }
  if (accepted.length % 10000 === 0) console.log(`${style}: ${accepted.length} tested, ${missing.length} missing, ${invalid.length} invalid`)
}
const blocksText = gunzipSync(await readFile(new URL('../data/unicode-18.0.0/Blocks.txt.gz', import.meta.url))).toString()
const blocks = blocksText.split('\n').map(line => line.split('#')[0].trim()).filter(Boolean).map(line => {
  const [span, block] = line.split(';'), [lo, hi] = span.trim().split('..').map(n => parseInt(n, 16))
  const absent = missing.filter(cp => cp >= lo && cp <= hi)
  return { block: block.trim(), missing: absent.length, ranges: ranges(absent) }
}).filter(row => row.missing)
const root = new URL('../', import.meta.url)
const inputFiles = [
  'src/core/ids.js', 'src/core/unicode.js', 'demo/lib/composer.js',
  'data/unicode-properties.json', 'data/unicode-coverage.json', 'data/bundled-coverage.json',
  'data/palette-fallback-characters.json', 'scripts/audit_render_coverage.mjs',
  ...(await readdir(new URL('src/composer/', root))).filter(name => /\.(js|json)$/.test(name)).map(name => `src/composer/${name}`),
]
const implementationHashes = Object.fromEntries(await Promise.all(inputFiles.sort().map(async name => [name, digest(await readFile(new URL(name, root)))])))
const report = {
  unicode: UNICODE_VERSION, style, base, implementationHashes,
  scope: 'Every accepted non-private scalar rendered separately through the preview worker. Does not test variation sequences, arbitrary IDS layouts, or visual fidelity.',
  accepted: accepted.length, drawn: drawn.length, missing: missing.length, invalid: invalid.length,
  privateUseExcluded: privateCount, missingRanges: ranges(missing), invalidRanges: ranges(invalid), blocks,
  localHashes: Object.fromEntries([...local].sort(([a], [b]) => a.localeCompare(b))),
  sourceHashes: Object.fromEntries([...fetched].sort(([a], [b]) => a.localeCompare(b))),
}
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ style, accepted: report.accepted, drawn: report.drawn, missing: report.missing, invalid: report.invalid }))
