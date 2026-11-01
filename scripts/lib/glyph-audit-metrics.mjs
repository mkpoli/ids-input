/** Structural review candidates in the composer's 1000-unit, y-down SVG frame.
 * Box metrics describe placement bounds; contour ink may occupy less space.
 * No pixel similarity or style score is used. A flag always needs visual review.
 */
export const GLYPH_AUDIT_THRESHOLDS = Object.freeze({
  em: 1000,
  outOfEmTolerance: 20,
  tinyMaxSide: 16,
  tinyMaxArea: 128,
  overlayMinGap: 10,
})

const ENCLOSURES = new Set(['⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿼', '⿽'])
const hasEnclosure = tree => Array.isArray(tree) &&
  (ENCLOSURES.has(tree[0]) || tree.slice(1).some(hasEnclosure))
const leaves = tree => Array.isArray(tree) ? tree.slice(1).flatMap(leaves) : [tree]
const finiteBox = box => Array.isArray(box) && box.length === 4 && box.every(Number.isFinite)
const positiveBox = box => finiteBox(box) && box[2] > 0 && box[3] > 0 &&
  Number.isFinite(box[0] + box[2]) && Number.isFinite(box[1] + box[3])
const nonfinitePath = d => typeof d === 'string' && /NaN|[+-]?Infinity|(?:\d\.?\d*|\.\d+)[eE][+-]?\d+/g.test(d) &&
  (d.match(/NaN|[+-]?Infinity|(?:\d\.?\d*|\.\d+)[eE][+-]?\d+/g) ?? []).some(token => !Number.isFinite(Number(token)))
const bounds = boxes => [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
  Math.max(...boxes.map(b => b[0] + b[2])), Math.max(...boxes.map(b => b[1] + b[3]))]

/** Eligibility is separate from flags: a skipped comparison offers no clean bill of health.
 * `allowOrderedGlyphOrigins` requires the caller to exclude modifiers and loose marks
 * in the original description, which the parsed tree cannot retain.
 */
export function auditGlyphMetricCoverage(tree, drawing, { allowOrderedGlyphOrigins = false } = {}) {
  const skip = skippedReason => ({ rootOverlay: { eligible: false, skippedReason, ownershipEvidence: null } })
  const eligible = ownershipEvidence => ({ rootOverlay: { eligible: true, skippedReason: null, ownershipEvidence } })
  const parts = drawing?.parts ?? []
  if (!Array.isArray(tree) || tree[0] !== '⿻' || tree.length !== 3) return skip('not-root-overlay')
  if (drawing?.cells) return skip('cells-layout')
  if (drawing?.slots?.length) return skip('empty-slots')
  if (drawing?.missing?.length) return skip('missing-glyphs')
  if (drawing?.cut || parts.some(p => p.cut)) return skip('cutouts')
  if (nonfinitePath(drawing?.d) || parts.some(p => !positiveBox(p.box) || nonfinitePath(p.d))) return skip('invalid-geometry')
  const allLeaves = leaves(tree)
  if (allLeaves.some(leaf => typeof leaf !== 'string' || leaf.startsWith('⬚'))) return skip('invalid-leaves')
  if (parts.length !== allLeaves.length) return skip('part-leaf-count-mismatch')
  const owners = new Set(parts.map(p => p.leaf))
  if (owners.size === allLeaves.length && parts.every(p => Number.isInteger(p.leaf) && p.leaf >= 0 && p.leaf < allLeaves.length)) {
    return eligible('explicit-leaf-indices')
  }
  // Never repair conflicting or partial indices with origin inference.
  if (allowOrderedGlyphOrigins && tree.slice(1).every(child => typeof child === 'string') &&
    parts.length === 2 && parts.every((p, i) => p.leaf === undefined && p.origin === `glyph ${tree[i + 1]}`)) {
    return eligible('ordered-glyph-origins')
  }
  return skip('unmapped-leaves')
}

/**
 * `tree` is a parsed IDS (a leaf string or [operator, ...operands]).
 * `drawing` is a compose() result; boxes are [x, y, width, height].
 * `known` means the catalogue attests this description to a character.
 * Pass the requested layout so explicitly requested cells remain unflagged.
 * Ownership uses explicit leaf indices or opt-in exact ordered glyph origins.
 */
export function auditGlyphMetrics(tree, drawing, { known = false, layout = 'auto', allowOrderedGlyphOrigins = false } = {}) {
  const flags = []
  const flag = (code, message, evidence = {}) => flags.push({ code, reviewCandidate: true, message, ...evidence })
  const thresholds = GLYPH_AUDIT_THRESHOLDS
  const parts = drawing?.parts ?? []
  if (known && layout === 'auto' && drawing?.cells === true && hasEnclosure(tree)) {
    flag('auto-cells-enclosure', 'A known enclosing description was drawn in automatic cells.')
  }

  for (const [index, part] of parts.entries()) {
    const box = part.box
    if (!finiteBox(box) || !Number.isFinite(box[0] + box[2]) || !Number.isFinite(box[1] + box[3]) || nonfinitePath(part.d)) {
      flag('nonfinite-geometry', 'A part has missing or nonfinite geometry.', { part: index })
      continue
    }
    const [x, y, width, height] = box
    const margin = thresholds.outOfEmTolerance
    if (Math.min(x, x + width) < -margin || Math.min(y, y + height) < -margin ||
      Math.max(x, x + width) > thresholds.em + margin || Math.max(y, y + height) > thresholds.em + margin) {
      flag('out-of-em-geometry', 'A part extends beyond the em box tolerance.', { part: index, box: [...box] })
    }
    // A narrow full-height stroke is ordinary. Both dimensions must be unusually small.
    if (!part.cut && width >= 0 && height >= 0 && Math.max(width, height) < thresholds.tinyMaxSide &&
      width * height < thresholds.tinyMaxArea) {
      flag('tiny-part', 'A part has an unusually small bounding box.', { part: index, box: [...box] })
    }
  }
  const invalidDrawingPath = nonfinitePath(drawing?.d) || nonfinitePath(drawing?.cut)
  if (invalidDrawingPath) {
    flag('nonfinite-geometry', 'The drawing path contains nonfinite coordinates.')
  }

  const coverage = auditGlyphMetricCoverage(tree, drawing, { allowOrderedGlyphOrigins }).rootOverlay
  if (!coverage.eligible) return flags
  const split = leaves(tree[1]).length
  const owner = (p, index) => coverage.ownershipEvidence === 'explicit-leaf-indices' ? p.leaf : index
  const a = bounds(parts.filter((p, i) => owner(p, i) < split).map(p => p.box))
  const b = bounds(parts.filter((p, i) => owner(p, i) >= split).map(p => p.box))
  const gap = Math.max(b[0] - a[2], a[0] - b[2], b[1] - a[3], a[1] - b[3])
  if (gap > thresholds.overlayMinGap) {
    flag('disjoint-root-overlay', 'The root overlay operands have separated placement bounds.', { gap, operandBounds: [a, b], ownershipEvidence: coverage.ownershipEvidence })
  }
  return flags
}
