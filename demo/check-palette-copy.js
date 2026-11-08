// A focused part copies itself with one keystroke: Ctrl/Cmd+C on a part button puts its character on
// the clipboard, where before it only selected the text and waited for a second press.
//
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-palette-copy.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.setDefaultNavigationTimeout(120000)
  await page.addInitScript(() => {
    const copied = []
    window.__copied = copied
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: text => { copied.push(text); return Promise.resolve() } },
    })
  })
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`)
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.waitForTimeout(1500)
  const part = page.locator('.parts-grid .part').nth(1)
  const character = (await part.locator('.part-text').textContent())?.trim()
  await part.focus()
  await page.keyboard.press('Control+c')
  await page.waitForTimeout(300)
  const copied = await page.evaluate(() => window.__copied)
  assert.deepEqual(copied, [character], 'the focused part lands on the clipboard in one keystroke')
  console.log(`PASS ${character} copies with one keystroke`)
} finally {
  await browser.close()
}
