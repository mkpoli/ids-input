import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { isComponentForm } from '@han-compose/composer/component-forms'
import { hasPaletteGlyph } from '@han-compose/composer/palette'
import { hasUnicodeGlyph } from '@han-compose/composer/unicode'
import { paletteRows } from '../src/adapter/babelstone.js'
import { GONGCHE_PARTS } from '../src/core/gongche.js'
import { isNode, parse, write } from '../src/core/ids.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)))
const gz = url => JSON.parse(gunzipSync(readFileSync(url)))
const engine = name => new URL(`../node_modules/@han-compose/composer/data/sources/${name}/outlines.json.gz`, import.meta.url)

it('accounts for the leaves of every shipped palette entry', () => {
  const rows = [...GONGCHE_PARTS, ...paletteRows(read('ids-parts.json')), ...gz(new URL('../data/small-seal.json.gz', import.meta.url)).parts]
  const remote = read('palette-remote-glyphs.json')
  expect(remote.base).toBe(COMPOSER_BASE)
  const remoteKeys = new Set(remote.keys)
  const local = ['tangut', 'small-seal', 'bopomofo'].map(name => gz(engine(name)).records)
  const missing = new Set()
  const visit = node => {
    if (node === null || isComponentForm(write(node))) return
    if (isNode(node)) return node.parts.forEach(visit)
    if (!hasPaletteGlyph(node) && !hasUnicodeGlyph(node) && !remoteKeys.has(node) && !local.some(records => records[node])) missing.add(node)
  }
  for (const { part, fragment, glyph } of rows) {
    if (glyph) {
      expect(hasPaletteGlyph(glyph)).toBe(true)
      continue
    }
    const text = /^\{\d+\}$/.test(part) ? fragment : part
    if (!text) continue
    const result = parse(text, { open: true })
    expect(result.problem).toBeUndefined()
    visit(result.tree)
  }
  expect([...missing]).toEqual([])
})
