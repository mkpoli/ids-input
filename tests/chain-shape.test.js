import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { chainPath } from '../src/core/chain-shape.js'
import { glyphWikiName } from '../scripts/build_custom_outlines.mjs'

describe('a stroke chain as a line', () => {
  it('joins each stroke to the last and fits the line to the square', () => {
    // 口: up the left side, across and down, back along the bottom, closed.
    expect(chainPath('#(-丨𠃍-一z)')).toBe('M120 880L120 120L880 120L880 880L120 880Z')
    expect(chainPath('-丨𠃍-一z')).toBe(chainPath('#(-丨𠃍-一z)'))
    expect(chainPath('#(H)')).toBe('M120 500L880 500')
    expect(chainPath('#(SH)')).toBe(chainPath('#(𠃊)'))
  })
  it('lifts the pen at b, ignores a crossing and bends a quarter circle', () => {
    expect(chainPath('#(丨b一)').match(/M/g)).toHaveLength(2)
    expect(chainPath('#(丨x3◞◟◜)')).toContain('Q')
    expect(chainPath('#(◟◜◝◞z)').match(/Q/g)).toHaveLength(4)
  })
  it('answers null for what is no chain it knows', () => {
    expect(chainPath('#(木)')).toBeNull()
    expect(chainPath('#(-)')).toBeNull()
    expect(chainPath('')).toBeNull()
  })
  it('draws every chain the tables write, inside the square', () => {
    const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-components.json.gz', import.meta.url))).toString('utf8'))
    for (const row of doc.components.filter(row => row.kind === 'chain')) {
      const d = chainPath(row.text)
      expect(d).not.toBeNull()
      for (const n of d.match(/-?\d+/g).map(Number)) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1000) }
    }
  })
})

describe('a CHISE entity\'s GlyphWiki name', () => {
  it('moves a variant from prefix to suffix', () => {
    expect(glyphWikiName('CDP-8958')).toBe('cdp-8958')
    expect(glyphWikiName('CDP-i001-8C40')).toBe('cdp-8c40-itaiji-001')
    expect(glyphWikiName('CDP-v005-88CB')).toBe('cdp-88cb-var-005')
    expect(glyphWikiName('U-i001+864D')).toBe('u864d-itaiji-001')
    expect(glyphWikiName('A-U-i001+20B36')).toBe('u20b36-itaiji-001')
    expect(glyphWikiName('U-000244EF')).toBe('u244ef')
    expect(glyphWikiName('UU+5368')).toBe('u5368')
    expect(glyphWikiName('AJ1-14521')).toBe('aj1-14521')
    expect(glyphWikiName('MJ018170')).toBe('jmj-018170')
    expect(glyphWikiName('GT-K00059')).toBe('gt-k00059')
    expect(glyphWikiName('M-30757')).toBe('dkw-30757')
  })
  it('names nothing where the two share no naming', () => {
    for (const name of ['C1-4F7E', 'JSP-5A39', 'HZK07-E671', 'HD-TK-01032130']) expect(glyphWikiName(name)).toBeNull()
  })
})

describe('data/custom-outlines.json.gz', () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-outlines.json.gz', import.meta.url))).toString('utf8'))
  it('names a GlyphWiki glyph for an entity, and has that glyph\'s outline', () => {
    expect(doc.format).toBe('ids-input/custom-outlines')
    expect(doc.names['&CDP-8958;']).toBe('cdp-8958')
    expect(doc.counts.entities).toBe(Object.keys(doc.names).length)
    for (const [entity, name] of Object.entries(doc.names)) {
      expect(glyphWikiName(entity.slice(1, -1))).toBe(name)
      expect(doc.outlines[name]).toMatch(/^M[-\d. LMZCQ]+Z/)
    }
    expect(doc.source.url).toBe('https://glyphwiki.org/')
    expect(doc.source.fetched).toMatch(/^\d{4}-\d\d-\d\d$/)
  })
})
