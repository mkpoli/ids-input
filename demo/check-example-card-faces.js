// The examples menu draws each card in the face the reader chose. Run against a devrun server:
//   IDS_URL=http://localhost:5186 CHROMIUM_PATH=… bun demo/check-example-card-faces.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5186'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.bar .font-choice').first().waitFor({ timeout: 120000 })
  const trigger = page.getByTitle('Examples', { exact: true })
  /** @param {string | null} [previous] A path the card must stop showing. */
  const firstPath = async previous => {
    await trigger.click()
    await page.locator('.menu .card-art path').first().waitFor({ timeout: 120000 })
    if (previous) await page.waitForFunction(path => document.querySelector('.menu .card-art path')?.getAttribute('d') !== path, previous, { timeout: 120000 })
    const path = await page.locator('.menu .card-art path').first().getAttribute('d')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    return path
  }

  const sans = await firstPath()
  assert.ok(sans && sans.length > 10, 'the Sans card draws the first example')
  for (const face of ['Serif', 'Fangsong', 'Regular', 'Pen']) {
    await page.locator(`.bar .font-choice[aria-label="${face}"]`).click()
    const path = await firstPath(sans)
    assert.notEqual(path, sans, `${face} cards draw their own outlines`)
  }
  console.log('PASS the example cards follow the five faces')
} finally { await browser.close() }
