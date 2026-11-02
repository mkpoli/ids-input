// The palette draws every part of its first page from the app's own faces, in a browser page whose
// CSS stack names the composer's faces first: the fallback sits before the page's own fonts, not
// behind them. Everything but the family's own faces is refused a font file, like a browser without
// a CJK font, and every part of the page must still draw ink.
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-fallback-order.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  // The installed fonts answer every request but the app's own, which leaves the fallback as the
  // only face that can draw a character the installed fonts lack.
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`)
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.waitForTimeout(2500)
  const blank = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 48
    canvas.height = 48
    const context = canvas.getContext('2d')
    const parts = [...document.querySelectorAll('.parts-grid .part')].slice(0, 24)
    return parts.filter(part => {
      context.clearRect(0, 0, 48, 48)
      context.font = `32px ${getComputedStyle(part).fontFamily}`
      context.fillText(part.textContent?.trim() ?? '', 4, 40)
      const data = context.getImageData(0, 0, 48, 48).data
      for (let i = 3; i < data.length; i += 4) if (data[i] > 100) return false
      return true
    }).map(part => part.textContent?.trim())
  })
  assert.deepEqual(blank, [], 'every part of the first page draws')
  console.log('PASS the palette draws every part with the fallback ahead of the installed fonts')
} finally { await browser.close() }
