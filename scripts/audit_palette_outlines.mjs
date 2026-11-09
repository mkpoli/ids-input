// Verify the shipped palette against the pinned default export and refresh its remote glyph index.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { GONGCHE_PARTS } from '../src/core/gongche.js'
import { paletteRows } from '../src/adapter/babelstone.js'
import { isNode, parse, write } from '../src/core/ids.js'
import { isComponentForm } from '@han-compose/composer/component-forms'
import { fromUrl } from '@han-compose/composer/loader'
import { hasUnicodeGlyph } from '@han-compose/composer/unicode'
import { hasPaletteGlyph } from '@han-compose/composer/palette'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)))
const gz = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}`, import.meta.url))))
const fromEngine = name => JSON.parse(gunzipSync(readFileSync(new URL(`../${name}`, import.meta.url))))
const rows = [...GONGCHE_PARTS, ...paletteRows(read('ids-parts.json')), ...gz('small-seal.json.gz').parts]
const ENGINE = 'node_modules/@han-compose/composer/data/sources/'
const local = ['tangut', 'small-seal', 'bopomofo'].map(name => fromEngine(`${ENGINE}${name}/outlines.json.gz`).records)
const needed = new Set()
const visit = node => {
  if (node === null || isComponentForm(write(node))) return
  if (isNode(node)) return node.parts.forEach(visit)
  if (!hasPaletteGlyph(node) && !hasUnicodeGlyph(node) && !local.some(records => records[node])) needed.add(node)
}
for (const { part, fragment } of rows) {
  const text = /^\{\d+\}$/.test(part) ? fragment : part
  if (!text) continue
  const result = parse(text, { open: true })
  if (result.problem) throw Error(`Invalid palette entry: ${part}`)
  visit(result.tree)
}
const source = fromUrl(COMPOSER_BASE)
await source.ready()
await source.load(source.filesOf([...needed]))
const store = source.store(), keys = [...needed].filter(key => store.rec(key)?.G)
const missing = [...needed].filter(key => !store.rec(key)?.G)
if (missing.length) throw Error(`No bundled or remote outline for: ${missing.join(' ')}`)
writeFileSync(new URL('../data/palette-remote-glyphs.json', import.meta.url), JSON.stringify({ base: COMPOSER_BASE, keys }) + '\n')
console.log(`${rows.length} entries verified; ${keys.length} rely on the default export`)
