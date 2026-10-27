// Group the composer's records and bundled Unicode glyphs by Unicode Script.
// Unicode 18.0 data is pinned by hash; optional local files avoid a repeat download.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parse, leaves, isLetter } from '../src/core/ids.js'
import { paletteRows } from '../src/adapter/babelstone.js'
import { isOtherScript } from '../src/core/scripts.js'
import { UNICODE_VERSION } from '../src/core/unicode.js'
if (UNICODE_VERSION !== '18.0.0') throw Error(`Update script data sources for Unicode ${UNICODE_VERSION}`)
const hashes = ['0071fd81b6aeae25f6e8bce8efec3066a6476a91b49bdb2f52dc76e817862a6a', '06c4c8eaf7b0bf34abe73b113da1215bd784ac254d4c223600b90267caa4bbbd']
const urls = ['https://www.unicode.org/Public/18.0.0/ucd/Scripts.txt', 'https://www.unicode.org/Public/18.0.0/ucd/PropertyValueAliases.txt']
const inputs = await Promise.all(urls.map(async (url, i) => {
  const bytes = process.argv[i + 2] ? readFileSync(process.argv[i + 2]) : Buffer.from(await (await fetch(url)).arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== hashes[i]) throw Error(`Unexpected Unicode data: ${url}`)
  return bytes.toString()
}))
const aliases = new Map()
for (const line of inputs[1].split('\n')) {
  const fields = line.split('#')[0].split(';').map(x => x.trim())
  if (fields[0] === 'sc' && fields[1] && fields[2]) aliases.set(fields[2], fields[1])
}
const ranges = []
for (const line of inputs[0].split('\n')) {
  const [span, name] = line.split('#')[0].split(';').map(x => x.trim())
  if (!span || !name) continue
  const [start, end = start] = span.split('..').map(x => parseInt(x, 16))
  ranges.push([start, end, aliases.get(name) ?? name])
}
ranges.sort((a, b) => a[0] - b[0])
writeFileSync(new URL('../data/script-ranges.json', import.meta.url), JSON.stringify(ranges) + '\n')
function script(char) {
  const cp = char.codePointAt(0)
  if (cp >= 0x3d000 && cp <= 0x3fc3f) return 'seal'
  if (cp >= 0x31c0 && cp <= 0x31ef) return 'strokes'
  if (cp >= 0x30 && cp <= 0x39) return 'latin'
  let lo = 0, hi = ranges.length - 1
  while (lo <= hi) { const mid = (lo + hi) >> 1, [first, last, name] = ranges[mid]; if (cp < first) hi = mid - 1; else if (cp > last) lo = mid + 1; else return ({ Hani: 'han', Latn: 'latin', Cyrl: 'cyrillic', Hang: 'hangul', Bopo: 'bopomofo', Tang: 'tangut', Zyyy: null, Zinh: null })[name] ?? (name === 'Zyyy' || name === 'Zinh' ? null : name) }
  return null
}
const coverage = JSON.parse(readFileSync(new URL('../data/unicode-coverage.json', import.meta.url)))
const entries = new Set()
const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
const seal = JSON.parse(gunzipSync(readFileSync(new URL('../data/small-seal.json.gz', import.meta.url))))
for (const row of [...paletteRows(palette), ...seal.parts]) entries.add(row.part)
for (const [first, last] of coverage) for (let cp = first; cp <= last; cp++) entries.add(String.fromCodePoint(cp))
const groups = new Map(), cache = new Map()
for (const key of entries) {
  const parsed = parse(key, { open: true })
  if (parsed.problem || parsed.tree === null) continue
  const scripts = new Set()
  for (const leaf of leaves(parsed.tree)) {
    if (!leaf.char) continue
    if (!cache.has(leaf.char)) cache.set(leaf.char, script(leaf.char))
    const name = cache.get(leaf.char)
    if (name) scripts.add(name)
  }
  const id = scripts.size > 1 ? 'mixed' : scripts.values().next().value ?? 'symbols'
  if (!groups.has(id)) groups.set(id, [])
  groups.get(id).push(key)
}
const rank = key => { if (leaves(parse(key, { open: true }).tree).length > 1 || /^[⿰-⿿㇯〾]/u.test(key)) return 3; return /\p{Number}/u.test(key) ? 1 : isLetter(key) ? 0 : /\p{Mark}/u.test(key) ? 4 : 2 }
const result = [...groups].filter(([id]) => isOtherScript(id)).map(([id, keys]) => ({ id, keys: keys.sort((a, b) => rank(a) - rank(b) || a.codePointAt(0) - b.codePointAt(0) || a.localeCompare(b, 'en')) })).sort((a, b) => b.keys.length - a.keys.length)
const index = result.map(({ id, keys }) => ({ id, count: keys.length }))
writeFileSync(new URL('../data/script-parts-index.json', import.meta.url), JSON.stringify(index) + '\n')
writeFileSync(new URL('../data/script-parts-metadata.json', import.meta.url), JSON.stringify({ unicode: UNICODE_VERSION, sources: urls.map((url, i) => ({ url, sha256: hashes[i] })) }) + '\n')
writeFileSync(new URL('../data/script-parts.json.gz', import.meta.url), gzipSync(JSON.stringify(Object.fromEntries(result.map(({ id, keys }) => [id, keys]))), { level: 9, mtime: 0 }))
console.log(`${result.reduce((n, group) => n + group.keys.length, 0)} entries across ${result.length} other scripts`)
