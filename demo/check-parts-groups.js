// The Components tab's chip row against a small palette: the curated parts, a stroke count, and the parts
// whose count was never recorded. Run against a devrun server:
//   IDS_URL=http://localhost:5173 bun demo/check-parts-groups.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
try {
  const page = await browser.newPage()
  await page.goto(new URL('/fixtures/parts-groups.html', url).href)
  await page.locator('.parts-counts button').first().waitFor()
  const chips = page.locator('.parts-counts button')
  const parts = page.locator('.parts-grid .part')
  const texts = async () => (await parts.allTextContents()).map(text => text.trim())
  const pressed = async () => (await chips.evaluateAll(els => els.map(el => el.getAttribute('aria-pressed'))))
  assert.equal(await page.getByRole('tab', { name: 'Stroke count', exact: true }).count(), 0, 'the stroke counts live in Components')
  assert.equal(await page.getByRole('tab', { name: 'Components', exact: true }).count(), 1, 'the tab names the components')
  assert.deepEqual(await chips.allTextContents(), ['Common', '4', '?', 'All characters'], 'the chips name the curated set, each count and the full list')
  assert.deepEqual(await pressed(), ['true', 'false', 'false', 'false'], 'the panel opens on the curated parts')
  assert.deepEqual(await texts(), ['木'], 'the curated chip shows the curated parts only')
  assert.equal(await chips.nth(1).getAttribute('title'), '4 strokes', 'the count keeps its name for hover and screen readers')
  await chips.nth(1).click()
  assert.deepEqual(await texts(), ['木', '艹'], 'a count shows every Han part of it')
  assert.deepEqual(await pressed(), ['false', 'true', 'false', 'false'], 'one chip is chosen at a time')
  await chips.nth(2).click()
  assert.deepEqual(await texts(), ['𒖨'], 'the unknown chip shows the parts without a stroke count')
  assert.deepEqual(await pressed(), ['false', 'false', 'true', 'false'], 'the curated chip is not chosen with an unknown count')
  await chips.nth(0).click()
  assert.deepEqual(await texts(), ['木'], 'the curated chip comes back')
  console.log('PASS the Components tab names the curated parts, each stroke count and the unknown count')
} finally { await browser.close() }
