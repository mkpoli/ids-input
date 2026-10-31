// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const errors = []
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  phone.on('pageerror', error => errors.push(error.message))
  await phone.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await phone.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const output = await phone.locator('.pane.output').boundingBox()
  const middle = await phone.locator('.middle').boundingBox()
  assert.ok(output && middle && output.y < middle.y, 'the drawing comes before the tree and results on a phone')
  await phone.close()
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desktop.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await desktop.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const dOutput = await desktop.locator('.pane.output').boundingBox()
  const dMiddle = await desktop.locator('.middle').boundingBox()
  assert.ok(dOutput && dMiddle && dOutput.x > dMiddle.x, 'the desktop columns keep their order')
  await desktop.close()
  assert.deepEqual(errors, [])
  console.log('PASS phone output comes before tree/results; desktop columns unchanged')
} finally { await browser.close() }
