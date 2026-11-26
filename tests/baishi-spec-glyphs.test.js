import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { EXAMPLES } from '../demo/lib/baishi.js'

const glyphs = JSON.parse(readFileSync(new URL('../demo/lib/baishi-spec-glyphs.json', import.meta.url), 'utf8'))
const page = readFileSync(new URL('../demo/Baishi.svelte', import.meta.url), 'utf8')

describe('the zi.tools IDS Extension page glyph witnesses', () => {
  it('resolve every glyph key referenced by EXAMPLES to a non-empty SVG path', () => {
    const used = new Set()
    for (const [group, list] of Object.entries(EXAMPLES)) {
      for (const ex of list) {
        if (ex.glyph) {
          used.add(ex.glyph)
          expect(typeof glyphs[ex.glyph], `${group} ${ex.char ?? ex.text}: ${ex.glyph}`).toBe('string')
          expect(glyphs[ex.glyph]).toMatch(/^M/)
        }
        for (const form of ex.forms ?? []) {
          if (!form.glyph) continue
          used.add(form.glyph)
          expect(typeof glyphs[form.glyph], `${group} ${ex.char ?? ex.text}: ${form.glyph}`).toBe('string')
          expect(glyphs[form.glyph]).toMatch(/^M/)
        }
      }
    }
    expect([...used].sort()).toEqual(Object.keys(glyphs).sort())
  })

  it('gives each contrasted or multi-variant example distinct glyph outlines', () => {
    for (const [group, list] of Object.entries(EXAMPLES)) {
      for (const ex of list) {
        if (!ex.forms?.length) continue
        const paths = ex.forms.map(f => f.glyph && glyphs[f.glyph]).filter(Boolean)
        expect(new Set(paths).size, `${group} ${ex.char ?? ex.text} must have distinct variant outlines`).toBe(paths.length)
      }
    }
  })

  it('credits every GlyphWiki witness revision in the sources section', () => {
    const kage = readFileSync(new URL('../scripts/build_baishi_spec_kage.mjs', import.meta.url), 'utf8')
    const revisions = [...kage.matchAll(/:\s*'([a-z0-9-]+@\d+)'/g)].map(m => m[1])
    expect(revisions.length).toBeGreaterThan(0)
    for (const rev of revisions) expect(page).toContain(rev)
  })
})
