import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { compose } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { hasPaletteGlyph, paletteSource } from '../src/composer/palette.js'

it('draws every palette fallback as an editable component', async () => {
  const chars = JSON.parse(readFileSync(new URL('../data/palette-fallback-characters.json', import.meta.url)))
  const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/palette-outlines.json.gz', import.meta.url))))
  expect(Object.keys(outlines.records).sort()).toEqual([...chars].sort())
  const source = paletteSource({ load: async () => outlines })
  for (const char of chars) {
    expect(hasPaletteGlyph(char)).toBe(true)
    expect(onlyBundled(`⿰${char}⬚`)).toBe(true)
    const drawn = await compose(source, `⿰${char}⬚`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${char}`)
    expect(drawn.parts[0].d.length).toBeGreaterThan(10)
  }
})

it('accounts for the leaves of every shipped palette entry', async () => {
  const { paletteRows } = await import('../src/adapter/babelstone.js')
  const { parse, isNode, write } = await import('../src/core/ids.js')
  const { isComponentForm } = await import('../src/composer/component-forms.js')
  const { hasUnicodeGlyph } = await import('../src/composer/unicode.js')
  const { COMPOSER_BASE } = await import('../demo/lib/composer.js')
  const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)))
  const gz = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}`, import.meta.url))))
  const rows = [...paletteRows(read('ids-parts.json')), ...gz('small-seal.json.gz').parts]
  const remote = read('palette-remote-glyphs.json')
  expect(remote.base).toBe(COMPOSER_BASE)
  const remoteKeys = new Set(remote.keys)
  const local = ['tangut-outlines.json.gz', 'small-seal-outlines.json.gz', 'bopomofo-outlines.json.gz']
    .map(name => gz(name).records)
  const missing = new Set()
  const visit = node => {
    if (node === null || isComponentForm(write(node))) return
    if (isNode(node)) return node.parts.forEach(visit)
    if (!hasPaletteGlyph(node) && !hasUnicodeGlyph(node) && !remoteKeys.has(node) && !local.some(records => records[node])) missing.add(node)
  }
  for (const { part } of rows) {
    const result = parse(part, { open: true })
    expect(result.problem).toBeUndefined()
    visit(result.tree)
  }
  expect([...missing]).toEqual([])
})
