import { expect, it } from 'bun:test'
import { glyphAuditConfidence } from '../scripts/lib/glyph-audit-confidence.mjs'

it('marks possible encoded routes without declaring a preview defect', () => {
  expect(glyphAuditConfidence({ sequence: '⿻[1:]木口' }).routes).toEqual(['exact-modifier-glyph'])
  expect(glyphAuditConfidence({ sequence: '⿾木' }).routes).toEqual(['encoded-approximation-glyph'])
  expect(glyphAuditConfidence({ sequence: '⿻[1:]⿾木口' }).routes).toEqual(['exact-modifier-glyph'])
  expect(glyphAuditConfidence({ sequence: '⿻木口' }).demoRouting).toBe('unverified')
  expect(glyphAuditConfidence({ sequence: '⿻木口', error: {} }, { style: 'serif' }).routes).toEqual(['sans-face-fallback'])
})

it('retains region tags and marks ambiguous character references', () => {
  const result = glyphAuditConfidence({ sequence: '⿻木口', attributions: [{ regions: 'G' }, { regions: 'J' }, { regions: 'G' }] }, { characters: ['甲', '乙', '甲'] })
  expect(result.regions).toEqual(['G', 'J'])
  expect(result.regionCompatibility).toBe('unverified')
  expect(result.ambiguousCharacter).toBe(true)
  expect(glyphAuditConfidence({ sequence: '⿻木口' }, { characters: ['甲', '甲'] }).ambiguousCharacter).toBe(false)
})
