// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-seal-parts.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage()
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173')
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Small Seal', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.locator('.parts-filter').fill('⿱𽀀朿')
  const part = page.locator('.parts-grid .part[data-character="⿱𽀀朿"]')
  await part.waitFor()
  assert.equal(await part.count(), 1)
  await page.locator('.parts-filter').fill('𽀀')
  assert.ok(await page.locator('.parts-grid .part').count() > 1)
  const custom = await browser.newPage()
  await custom.goto(new URL('/fixtures/seal-parts.html', process.env.IDS_URL ?? 'http://localhost:5173').href)
  await custom.getByRole('tab', { name: 'Small Seal', exact: true }).click()
  await custom.locator('.parts-filter').fill('⿱𽀀朿')
  // The fixture's palette holds no such compound; the filter may still list a part its text names.
  assert.equal(await custom.locator('.parts-grid .part[data-character="⿱𽀀朿"]').count(), 0)
  assert.equal(await custom.locator('.parts-grid .part').count(), 1)
  await custom.close()
  console.log('PASS additional Small Seal descriptions and search')
} finally { await browser.close() }
