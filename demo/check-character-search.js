// Run against a devrun server: IDS_URL, CHROMIUM_PATH, optional IDS_CHARACTER_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5194'}/?lang=en`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Characters' }).click()
    const input = page.locator('.ids-pick-panel:not([hidden]) .ids-find input[type="search"]')
    await input.fill('hillock or mound')
    await page.waitForFunction(() => [...document.querySelectorAll('.ids-pick-panel:not([hidden]) .ids-hit-char')].some(el => el.textContent === '㐀'), null, { timeout: 20000 })
    assert.ok(!(await page.getByRole('checkbox', { name: 'Include rare characters' }).count()), 'no rare opt-in is needed')
    if (process.env.IDS_CHARACTER_SHOTS) {
      mkdirSync(process.env.IDS_CHARACTER_SHOTS, { recursive: true })
      await page.evaluate(() => document.fonts.ready)
      await page.locator('.ids-search').screenshot({ path: `${process.env.IDS_CHARACTER_SHOTS}/${scheme}.png` })
    }
    await page.close()
  }
} finally {
  await browser.close()
}
