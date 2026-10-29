// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.fill('⿰木⬚')
  await field.press('Tab')
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const save = async () => {
    const wait = page.waitForEvent('download')
    await page.getByRole('button', { name: /Save SVG/i }).click()
    const path = await (await wait).path()
    assert.ok(path, 'the SVG downloaded')
    return readFileSync(path, 'utf8')
  }
  const toggle = page.getByLabel('Include empty slots')
  await toggle.check()
  const withSlots = await save()
  assert.ok(withSlots.includes('stroke-dasharray="12 8"'), 'empty slots are exported')
  await toggle.uncheck()
  const withoutSlots = await save()
  assert.ok(!withoutSlots.includes('stroke-dasharray="12 8"'), 'empty slots are omitted')
  console.log('PASS scoped export includes empty slots on request')
} finally { await browser.close() }
