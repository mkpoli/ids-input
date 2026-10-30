// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-find-strokes.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Find', exact: true }).click()
  const panel = page.locator('.ids-pick-panel:not([hidden])')
  await panel.locator('.ids-find input[type="search"]').fill('hillock or mound')
  const has = char => page.waitForFunction(expected => [...document.querySelectorAll('.ids-pick-panel:not([hidden]) .ids-hit-char')].some(el => el.textContent === expected), char)
  await has('㐀')
  const strokes = panel.locator('.ids-find input.ids-strokes')
  await strokes.fill('5')
  await has('㐀')
  await strokes.fill('4')
  await page.waitForFunction(() => ![...document.querySelectorAll('.ids-pick-panel:not([hidden]) .ids-hit-char')].some(el => el.textContent === '㐀'))
  assert.ok(await panel.locator('.ids-note, .ids-found').count() > 0)
  await strokes.fill('')
  await has('㐀')
  console.log('PASS the Find tab narrows by stroke count')
} finally { await browser.close() }
