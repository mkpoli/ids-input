import { GONGCHE_PARTS } from '../src/core/gongche.js'
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { compose } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { hasPaletteGlyph, paletteSource } from '../src/composer/palette.js'

it('draws every palette fallback as an editable component', async () => {
  const chars = JSON.parse(readFileSync(new URL('../data/palette-fallback-characters.json', import.meta.url)))
  const numbered = new Set(Object.keys(JSON.parse(readFileSync(new URL('../data/numbered-forms.json', import.meta.url))).forms.sans))
  const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/palette-outlines.json.gz', import.meta.url))))
  expect(Object.keys(outlines.records).sort()).toEqual([...chars].sort())
  const source = paletteSource({ load: async () => outlines })
  for (const char of chars) {
    if (numbered.has(char)) continue
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
  const { hasPaletteGlyph } = await import('../src/composer/palette.js')
  const { hasUnicodeGlyph } = await import('../src/composer/unicode.js')
  const { COMPOSER_BASE } = await import('../demo/lib/composer.js')
  const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)))
  const gz = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}`, import.meta.url))))
  const rows = [...GONGCHE_PARTS, ...paletteRows(read('ids-parts.json')), ...gz('small-seal.json.gz').parts]
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

describe('the palette under an export', () => {
  const record = { o: 1, ink: 1 }
  const exported = rec => ({
    manifest: { constants: {} }, layout: null,
    ready: async () => {}, load: async () => {}, filesOf: keys => new Set(keys),
    store: () => ({ manifest: {}, layout: null, missing: new Set(), rec, hosts: () => [{ h: '江' }], places: () => ['L'] }),
  })
  const over = async fallback => {
    const source = paletteSource({ load: async () => ({ records: { 江: record } }), fallback, under: true })
    await source.ready()
    return source
  }
  it('lets the export draw a character it holds', async () => {
    const own = { o: 2, ink: 2, G: {} }
    const source = await over(exported(key => key === '江' ? own : null))
    expect(source.store().rec('江')).toBe(own)
    expect(source.store().hosts('江', 'L')).toEqual([{ h: '江' }])
    expect(source.filesOf(['江'])).toEqual(new Set(['江']))
  })
  it('fills in what the export lacks', async () => {
    const source = await over(exported(() => null))
    expect(source.store().rec('江')).toBe(record)
    expect(source.store().hosts('江', 'L')).toEqual([])
  })
  it('keeps its outline over a record that cannot draw', async () => {
    const source = await over(exported(key => key === '江' ? { o: 1, ink: 1 } : null))
    expect(source.store().rec('江')).toBe(record)
  })
  it('owns its characters in Sans, as ever', async () => {
    const source = paletteSource({ load: async () => ({ records: { 江: record } }), fallback: exported(() => ({ o: 2, ink: 2, G: {} })) })
    await source.ready()
    expect(source.store().rec('江')).toBe(record)
  })
  it('stays local for every face when the export cannot be read', async () => {
    const { onlyBundled } = await import('../src/composer/local.js')
    for (const face of ['sans', 'serif', 'fangsong', 'kaisho']) expect(onlyBundled('江', false, true, face)).toBe(true)
  })
  it('needs an export only where the face has its own glyphs', async () => {
    const { onlyBundled } = await import('../src/composer/local.js')
    expect(onlyBundled('江', false, false, 'sans')).toBe(true)
    for (const face of ['serif', 'fangsong', 'kaisho']) expect(onlyBundled('江', false, false, face)).toBe(false)
  })
})
