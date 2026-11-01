import { APPROXIMATE } from '../../src/composer/compose.js'

/** The demo may resolve a sequence before the direct composer sees it.
 * These labels describe unverified routes; they are not correctness verdicts. */
export function glyphAuditConfidence(row, { style = 'sans', characters = [] } = {}) {
  const routes = []
  if (row.sequence.includes('[')) routes.push('exact-modifier-glyph')
  if (!row.sequence.includes('[') && APPROXIMATE.some(op => row.sequence.includes(op))) routes.push('encoded-approximation-glyph')
  if (row.error && style !== 'sans') routes.push('sans-face-fallback')
  const regions = [...new Set((row.attributions ?? []).map(entry => entry.regions).filter(Boolean))]
  return { scope: 'direct-composer', demoRouting: routes.length ? 'override-possible' : 'unverified', routes, regions,
    regionCompatibility: 'unverified', ambiguousCharacter: new Set(characters).size > 1,
    referenceCaveat: 'The selected-export reference may use a different regional form; composed operands may use fallback fonts.' }
}
