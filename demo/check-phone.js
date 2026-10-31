// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await phone.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await phone.locator('.ids-preview[data-step="composed"]').waitFor({ state: 'attached', timeout: 30000 })
  const tabs = phone.locator('.phone-tabs')
  assert.equal(await tabs.isVisible(), true, 'the phone tabs are visible')
  assert.equal(await tabs.locator('svg').count(), 3, 'each phone tab has an icon')
  assert.equal(await phone.locator('.pane.input').isVisible(), true, 'Input opens first')
  assert.equal(await phone.locator('.middle').isVisible(), false, 'the compose column is not stacked below')
  assert.equal(await phone.locator('.pane.output').isVisible(), false, 'the output is not stacked below')
  await tabs.getByRole('tab', { name: 'Compose', exact: true }).click()
  assert.equal(await phone.locator('.middle').isVisible(), true, 'Compose shows the tree and search tools')
  assert.equal(await phone.locator('.pane.input').isVisible(), false)
  await tabs.getByRole('tab', { name: 'Output', exact: true }).click()
  assert.equal(await phone.locator('.pane.output').isVisible(), true, 'Output shows the drawing and export')
  assert.equal(await phone.locator('.middle').isVisible(), false)
  await phone.close()

  const tablet = await browser.newPage({ viewport: { width: 768, height: 1024 } })
  await tablet.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await tablet.locator('.ids-preview[data-step="composed"]').waitFor({ state: 'attached', timeout: 30000 })
  assert.equal(await tablet.locator('.phone-tabs').isVisible(), true, 'the single-column tablet has tabs')
  assert.equal(await tablet.locator('.pane.input').isVisible(), true)
  assert.equal(await tablet.locator('.pane.output').isVisible(), false)
  await tablet.close()

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desktop.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await desktop.locator('.ids-preview[data-step="composed"]').waitFor({ state: 'attached', timeout: 30000 })
  assert.equal(await desktop.locator('.phone-tabs').isVisible(), false, 'desktop has no phone tabs')
  for (const selector of ['.pane.input', '.middle', '.pane.output']) assert.equal(await desktop.locator(selector).isVisible(), true, `${selector} stays visible on desktop`)
  await desktop.close()
  console.log('PASS phone/tablet tabs switch Input, Compose and Output; desktop keeps all columns')
} finally { await browser.close() }
