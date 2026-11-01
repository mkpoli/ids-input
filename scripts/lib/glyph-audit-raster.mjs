// Pixel differences rank candidates for inspection; they do not certify mistakes.
import { chromium } from 'playwright-core'

export function glyphRasterStatistics({ size, intersection, union, actual, native }) {
  return { resolution: size, iou: native > 0 ? (union ? intersection / union : 1) : null,
    inkRatio: native > 0 ? actual / native : null, actualPixels: actual, referencePixels: native }
}

export async function createRasterComparator({ executablePath = process.env.CHROMIUM_PATH } = {}) {
  const browser = await chromium.launch({ executablePath, headless: true })
  const page = await browser.newPage()
  return {
    async compare(drawing, reference) {
      const counts = await page.evaluate(({ drawing, reference }) => {
        const size = 128
        const mask = drawing => {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = size
          const ctx = canvas.getContext('2d')
          ctx.scale(size / 1000, size / 1000)
          ctx.fill(new Path2D(drawing.d))
          if (drawing.cut) {
            ctx.globalCompositeOperation = 'destination-out'
            ctx.fill(new Path2D(drawing.cut))
          }
          const rgba = ctx.getImageData(0, 0, size, size).data
          return Array.from({ length: size * size }, (_, i) => rgba[i * 4 + 3] >= 128 ? 1 : 0)
        }
        const a = mask(drawing), b = mask(reference)
        let intersection = 0, union = 0, actual = 0, native = 0
        for (let i = 0; i < a.length; i++) {
          intersection += a[i] && b[i] ? 1 : 0
          union += a[i] || b[i] ? 1 : 0
          actual += a[i]
          native += b[i]
        }
        return { size, intersection, union, actual, native }
      }, { drawing: { d: drawing.d, cut: drawing.cut }, reference: { d: reference.d, cut: reference.cut } })
      return glyphRasterStatistics(counts)
    },
    close: () => browser.close(),
  }
}
