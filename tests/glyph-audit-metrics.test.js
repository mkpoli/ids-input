import { describe, expect, it } from 'bun:test'
import { auditGlyphMetrics, auditGlyphMetricCoverage, GLYPH_AUDIT_THRESHOLDS as T } from '../scripts/lib/glyph-audit-metrics.mjs'
import { compose, createSource } from '../src/composer/loader.js'
import { files } from './fixtures/composer-export.js'

const overlay = ['⿻', '木', '口']
const part = (leaf, box = [100, 100, 300, 300], extra = {}) => ({ leaf, box, d: 'M100 100L400 400Z', ...extra })
const codes = (tree, drawing, options) => auditGlyphMetrics(tree, drawing, options).map(flag => flag.code)
const separated = () => ({ parts: [part(0), part(1, [600, 100, 300, 300])] })

describe('structural glyph audit review candidates', () => {
  it('exports immutable explicit thresholds and marks every flag for review', () => {
    expect(Object.isFrozen(T)).toBe(true)
    expect(T.em).toBe(1000)
    const flags = auditGlyphMetrics(overlay, separated())
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ code: 'disjoint-root-overlay', reviewCandidate: true, gap: 200 })
  })

  it('flags automatic cells only for known descriptions containing an enclosure', () => {
    const tree = ['⿰', '木', ['⿴', '囗', '口']]
    const drawing = { cells: true, parts: [] }
    expect(codes(tree, drawing, { known: true })).toEqual(['auto-cells-enclosure'])
    expect(codes(tree, drawing)).toEqual([])
    expect(codes(tree, drawing, { known: true, layout: 'cells' })).toEqual([])
    expect(codes(tree, { parts: [] }, { known: true })).toEqual([])
    expect(codes(['⿰', '木', '木'], drawing, { known: true })).toEqual([])
  })

  it('detects nonfinite boxes, arithmetic overflow and nonfinite SVG paths', () => {
    for (const box of [[NaN, 0, 100, 100], [0, Infinity, 100, 100], [0, 0, -Infinity, 10], [Number.MAX_VALUE, 0, Number.MAX_VALUE, 10]]) {
      expect(codes('木', { parts: [part(0, box)] })).toEqual(['nonfinite-geometry'])
    }
    for (const d of ['MNaN 0Z', 'M0 InfinityZ', 'M1e999 0Z']) {
      expect(codes('木', { parts: [part(0, undefined, { d })] })).toEqual(['nonfinite-geometry'])
      expect(codes('木', { d, parts: [] })).toEqual(['nonfinite-geometry'])
    }
    expect(codes('木', { parts: [part(0, undefined, { d: 'M1e2 -2E-1L300 400Z' })] })).toEqual([])
  })

  it('uses SVG width/height and tolerates modest em overshoot', () => {
    const edge = T.em + T.outOfEmTolerance
    expect(codes('木', { parts: [part(0, [-T.outOfEmTolerance, 0, edge + T.outOfEmTolerance, 1000])] })).toEqual([])
    for (const box of [[900, 100, 121, 100], [100, 900, 100, 121], [-21, 100, 100, 100], [100, -21, 100, 100]]) {
      expect(codes('木', { parts: [part(0, box)] })).toEqual(['out-of-em-geometry'])
    }
  })

  it('flags very small parts while allowing thin strokes, ordinary dots and cutouts', () => {
    expect(codes('丶', { parts: [part(0, [100, 100, 5, 5])] })).toEqual(['tiny-part'])
    expect(codes('丶', { parts: [part(0, [100, 100, 0, 0])] })).toEqual(['tiny-part'])
    for (const box of [[100, 100, 5, 400], [100, 100, 400, 5], [100, 100, 30, 30], [100, 100, T.tinyMaxSide, 1], [100, 100, 12, 12]]) {
      expect(codes('丶', { parts: [part(0, box)] })).toEqual([])
    }
    expect(codes('丶', { parts: [part(0, [100, 100, 5, 5], { cut: true })] })).toEqual([])
  })

  it('compares root operand unions using explicit leaf indices, independent of part order', () => {
    const tree = ['⿻', ['⿰', '木', '木'], '口']
    const drawing = { parts: [part(2, [700, 100, 100, 300]), part(1, [300, 100, 100, 300]), part(0, [100, 100, 100, 300])] }
    expect(codes(tree, drawing)).toEqual(['disjoint-root-overlay'])
    expect(codes(['⿰', ...tree.slice(1)], drawing)).toEqual([])
    expect(codes(['⿰', overlay, '木'], drawing)).toEqual([])
  })

  it('allows overlapping, touching, and nearly touching overlay bounds', () => {
    for (const x of [200, 400, 400 + T.overlayMinGap]) {
      expect(codes(overlay, { parts: [part(0), part(1, [x, 100, 300, 300])] })).toEqual([])
    }
    expect(codes(overlay, { parts: [part(0), part(1, [100, 600, 300, 300])] })).toEqual(['disjoint-root-overlay'])
  })

  it('skips overlays without a trustworthy bijective leaf mapping', () => {
    for (const parts of [[part(undefined), part(undefined, [600, 100, 300, 300])], [part(0), part(0)], [part(0), part(2)], [part(0), part(0.5)], [part(0)], [...separated().parts, part(2)]]) {
      expect(codes(overlay, { parts })).not.toContain('disjoint-root-overlay')
    }
    for (const extra of [{ slots: [{ index: 0 }] }, { missing: ['木'] }, { cut: 'M0 0Z' }, { cells: true }, { d: 'MNaN 0Z' }]) {
      expect(codes(overlay, { ...separated(), ...extra })).not.toContain('disjoint-root-overlay')
    }
    expect(codes(overlay, { parts: [part(0, undefined, { cut: true }), part(1, [600, 100, 300, 300])] })).not.toContain('disjoint-root-overlay')
    expect(codes(overlay, { parts: [part(0, [0, 0, -10, 100]), part(1)] })).not.toContain('disjoint-root-overlay')
    expect(codes(['⿻', '⬚', '口'], separated())).not.toContain('disjoint-root-overlay')
  })

  it('reports eligibility and concrete reasons for skipped root comparisons', () => {
    const coverage = (tree, drawing) => auditGlyphMetricCoverage(tree, drawing).rootOverlay
    expect(coverage(overlay, separated())).toEqual({ eligible: true, skippedReason: null, ownershipEvidence: 'explicit-leaf-indices' })
    expect(coverage('木', separated()).skippedReason).toBe('not-root-overlay')
    for (const [extra, reason] of [[{ cells: true }, 'cells-layout'], [{ slots: [{}] }, 'empty-slots'], [{ missing: ['木'] }, 'missing-glyphs'], [{ cut: 'M0 0Z' }, 'cutouts'], [{ d: 'MNaN 0Z' }, 'invalid-geometry'], [{ parts: [] }, 'part-leaf-count-mismatch']]) {
      expect(coverage(overlay, { ...separated(), ...extra })).toEqual({ eligible: false, skippedReason: reason, ownershipEvidence: null })
    }
  })

  it('allows exact ordered literal glyph origins only with caller opt-in', () => {
    const options = { allowOrderedGlyphOrigins: true }
    const drawing = { parts: [part(undefined, undefined, { origin: 'glyph 木' }), part(undefined, [600, 100, 300, 300], { origin: 'glyph 口' })] }
    expect(auditGlyphMetricCoverage(overlay, drawing).rootOverlay.skippedReason).toBe('unmapped-leaves')
    expect(auditGlyphMetricCoverage(overlay, drawing, options).rootOverlay.ownershipEvidence).toBe('ordered-glyph-origins')
    expect(auditGlyphMetrics(overlay, drawing, options)[0]).toMatchObject({ code: 'disjoint-root-overlay', ownershipEvidence: 'ordered-glyph-origins' })
    for (const origins of [['glyph 口', 'glyph 木'], ['glyph 木', 'glyph 日'], ['host 木', 'glyph 口']]) {
      const changed = { parts: drawing.parts.map((p, i) => ({ ...p, origin: origins[i] })) }
      expect(auditGlyphMetricCoverage(overlay, changed, options).rootOverlay.eligible).toBe(false)
    }
    for (const extra of [{ cells: true }, { slots: [{}] }, { missing: ['木'] }, { cut: 'M0 0Z' }, { d: 'MNaN 0Z' }]) {
      expect(auditGlyphMetricCoverage(overlay, { ...drawing, ...extra }, options).rootOverlay.eligible).toBe(false)
    }
    const partial = { parts: drawing.parts.map((p, i) => i ? p : { ...p, leaf: 0 }) }
    expect(auditGlyphMetricCoverage(overlay, partial, options).rootOverlay.eligible).toBe(false)
    expect(auditGlyphMetricCoverage(['⿻', ['⿾', '木'], '口'], drawing, options).rootOverlay.eligible).toBe(false)
  })

  it('accepts ordered glyph origins from a real compose fixture', async () => {
    const source = createSource(async name => {
      const body = files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const drawing = await compose(source, '⿻木口', { separate: true })
    expect(drawing.parts.map(p => p.origin)).toEqual(['glyph 木', 'glyph 口'])
    expect(drawing.parts.every(p => p.leaf === undefined)).toBe(true)
    expect(auditGlyphMetricCoverage(overlay, drawing, { allowOrderedGlyphOrigins: true }).rootOverlay).toEqual({
      eligible: true, skippedReason: null, ownershipEvidence: 'ordered-glyph-origins',
    })
  })

  it('does not score style or pixel differences', () => {
    expect(codes(overlay, { parts: [part(0, undefined, { d: 'M1 1Z' }), part(1, undefined, { d: 'M999 999Z' })] })).toEqual([])
  })
})
