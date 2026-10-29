// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill('⿰木口')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: 'Adjust layout', exact: true }).click()
    const svg = page.locator('.ids-preview-large svg')
    const box = await svg.boundingBox()
    assert.ok(box, 'the preview has a drawing box')
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5)
    await page.waitForTimeout(300)
    await page.locator('.ids-preview .handle.move').waitFor({ timeout: 5000 })
    const first = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.chosen)
    assert.ok(first, 'clicking a layer chooses it')
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5)
    await page.waitForTimeout(300)
    const second = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.chosen)
    assert.ok(second && second !== first, 'clicking the other layer changes the choice')
    console.log(`PASS ${scheme}: canvas click selects layers and reveals handles`)
    await page.close()
  }
} finally { await browser.close() }
