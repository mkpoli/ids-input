// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    for (const [width, height] of [[390, 844], [768, 1024]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500, colorScheme: scheme })
      await page.goto(process.env.IDS_URL ?? 'http://localhost:5199', { waitUntil: 'domcontentloaded' })
      await page.locator('.ids-preview[data-step="composed"]').waitFor({ state: 'attached', timeout: 30000 })
      await page.waitForTimeout(300)
      for (const tab of ['Input', 'Compose', 'Output']) {
        await page.locator('.phone-tabs').getByRole('tab', { name: tab, exact: true }).click()
        for (let step = 0; step < 20; step++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40) }
        const seen = await page.evaluate(() => {
          const tabs = document.querySelector('.phone-tabs'), bar = document.querySelector('.chrome')
          const box = tabs.getBoundingClientRect(), barBox = bar.getBoundingClientRect()
          const middle = document.elementFromPoint(innerWidth / 2, box.top + box.height / 2)
          return { top: Math.round(box.top), bottom: Math.round(box.bottom), barBottom: Math.round(barBox.bottom), onTabs: Boolean(middle?.closest('.phone-tabs')), scrollY: Math.round(scrollY) }
        })
        const where = `${scheme} ${width}px, ${tab} at ${seen.scrollY}px`
        assert.ok(seen.bottom <= height, `${where}: the tabs stay on screen (${seen.top}–${seen.bottom})`)
        assert.ok(seen.top >= seen.barBottom - 1, `${where}: the toolbar does not cover the tabs (tabs ${seen.top}, toolbar ends ${seen.barBottom})`)
        assert.equal(seen.onTabs, true, `${where}: nothing covers the tabs`)
      }
      await page.close()
    }
  }
  console.log('PASS phone tabs stay below the toolbar while every pane scrolls, light and dark, phone and tablet')
} finally { await browser.close() }
