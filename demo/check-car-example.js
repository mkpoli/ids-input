// The car example: the Examples menu lists the composition, and opening it composes the emoji as
// coloured text instead of the prepared path, which would ink the car in the tab's colour.
// Run against a devrun server:
//   IDS_URL=http://localhost:5173 CHROMIUM_PATH=… bun demo/check-car-example.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })

  await page.getByTitle('Examples', { exact: true }).click()
  await page.locator('.menu').waitFor()
  const card = page.locator('.menu .card', { hasText: '⿱車🚗' }).first()
  await card.waitFor({ timeout: 30000 })
  assert.equal(await card.count(), 1, 'the Examples menu lists the car composition')

  await card.click()
  await page.waitForTimeout(400)
  assert.equal(await page.locator('.ids-field input').inputValue(), '⿱車🚗', 'the example opens its sequence')

  const preview = page.locator('.ids-preview-large text')
  await preview.waitFor({ timeout: 120000 })
  assert.equal(await preview.textContent(), '🚗', 'the preview draws the emoji as text, not the prepared path')
  assert.ok(await page.locator('.ids-preview-large path').count(), 'the preview still draws 車')

  const tab = page.locator('.tabbar .tab.on .tab-glyph text')
  await tab.waitFor({ timeout: 120000 })
  assert.equal(await tab.textContent(), '🚗', 'the tab draws the emoji as text too')
  assert.deepEqual(errors, [])
  await page.locator('.ids-preview-large').screenshot({ path: process.env.SHOT ?? '/tmp/car-example.png' })
  console.log('PASS the car example opens and draws its emoji as text')
} finally { await browser.close() }
