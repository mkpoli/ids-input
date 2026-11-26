import { describe, expect, it } from 'bun:test'
import { Resvg } from '@cf-wasm/resvg/node'
import { enclosed, SQUARE } from '../scripts/lib/outline.mjs'
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

  it('pairs each stroke-level 七 glyph with its lv0 description', () => {
    const seven = EXAMPLES.lists.find(example => example.char === '七')
    expect(seven.at).toEqual(['DB', 'lv0 l.4'])
    expect(seven.forms.map(({ glyph, body, tag }) => [glyph, body, tag])).toEqual([
      ['七.', '⿻乚.一.', '.'], ['七T', '⿻乚w一.', 'T'], ['七t', '⿻乚t一.', 't'],
    ])
    expect(seven.text).toBe(seven.forms.map(({ body, tag }) => `${body}(${tag})`).join(';'))
  })

  it('encloses the 巳 counter in 卮qq123 at the previous ink size', async () => {
    const raster = glyph => Resvg.async(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SQUARE}" height="${SQUARE}" viewBox="0 0 1000 1000"><path d="${glyphs[glyph]}"/></svg>`,
    )
    const countersOf = renderer => {
      const { pixels } = renderer.render()
      const ink = Uint8Array.from({ length: SQUARE * SQUARE }, (_, at) => pixels[at * 4 + 3] >= 128 ? 1 : 0)
      return enclosed(ink, 20)
    }
    const [base, variant] = await Promise.all([raster('卮.'), raster('卮qq123')])
    expect(countersOf(base)).toHaveLength(0)
    const counters = countersOf(variant)
    expect(counters).toHaveLength(1)
    expect(counters[0]).toContain(106 * SQUARE + 120)
    const { x, y, width, height } = variant.getBBox()
    expect([x, y, width, height].map(value => Number(value.toFixed(1)))).toEqual([31.6, 46.3, 931.2, 915.7])
  })

  it('credits every GlyphWiki witness revision in GLYPHWIKI_CREDITS', () => {
    const kage = readFileSync(new URL('../scripts/build_baishi_spec_kage.mjs', import.meta.url), 'utf8')
    const revisions = [...kage.matchAll(/:\s*'([a-z0-9-]+@\d+)'/g)].map(m => m[1])
    const creditsBlock = page.match(/const GLYPHWIKI_CREDITS =[\s\S]*?\]\)/)?.[0] ?? ''
    expect(revisions.length).toBeGreaterThan(0)
    expect(creditsBlock.length).toBeGreaterThan(0)
    for (const rev of revisions) expect(creditsBlock).toContain(rev)
  })

  it('gives contrasted segment forms distinct accessible names', () => {
    const seg = Object.values(EXAMPLES).flat().find(ex => ex.char === '𠀁')
    expect(seg?.forms?.map(f => f.char)).toEqual(['𠀁', '⿻[b]㇉一'])
    expect(seg?.forms?.map(f => f.to)).toEqual(['⿻㇉一', undefined])
  })
})
