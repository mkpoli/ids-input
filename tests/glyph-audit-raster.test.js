import { expect, it } from 'bun:test'
import { createRasterComparator, glyphRasterStatistics } from '../scripts/lib/glyph-audit-raster.mjs'

it('leaves empty references unscorable rather than implying missing ink', () => {
  expect(glyphRasterStatistics({ size: 128, intersection: 0, union: 8, actual: 8, native: 0 }))
    .toEqual({ resolution: 128, iou: null, inkRatio: null, actualPixels: 8, referencePixels: 0 })
  expect(glyphRasterStatistics({ size: 128, intersection: 4, union: 8, actual: 6, native: 6 }).iou).toBe(0.5)
  expect(glyphRasterStatistics({ size: 128, intersection: 0, union: 8, actual: 0, native: 8 }).inkRatio).toBe(0)
})

it.skipIf(!process.env.CHROMIUM_PATH)('rasterizes cutouts, empty references, and em clipping', async () => {
  const comparator = await createRasterComparator()
  const square = { d: 'M0 0H1000V1000H0Z' }
  const half = { d: 'M0 0H500V1000H0Z' }
  try {
    expect((await comparator.compare(square, square)).iou).toBe(1)
    const cut = await comparator.compare({ ...square, cut: 'M500 0H1000V1000H500Z' }, half)
    expect(cut.iou).toBe(1)
    expect(cut.inkRatio).toBe(1)
    expect((await comparator.compare(square, { d: '' })).iou).toBeNull()
    expect((await comparator.compare({ d: 'M-500 -500H1500V1500H-500Z' }, square)).iou).toBe(1)
  } finally { await comparator.close() }
})
