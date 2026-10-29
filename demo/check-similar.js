// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-similar.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  // Similar structures sit under the structure's own matches, with no mode of their own.
  assert.deepEqual(await page.locator('.search-modes button').allTextContents(),
    ['Characters with this structure', 'Component lookup', 'Structural search'])
  const field = page.locator('.ids-field input')
  await field.fill('⿱雨林')
  const similar = page.locator('.similar .ids-search-results .hit .char')
  await similar.first().waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.similar .ids-search-results .hit .char').length >= 6)
  const chars = await similar.allTextContents()
  // 森 and 箖 share 林 under ⿱; 霖 is the description itself and stays out.
  assert.ok(chars.includes('森'), `森 missing from ${chars}`)
  assert.ok(chars.includes('箖'), `箖 missing from ${chars}`)
  assert.ok(!chars.includes('霖'), `the description's own character is listed: ${chars}`)
  assert.match(await page.locator('.similar .label').textContent(), /⿱雨林/u)
  // The structure's own matches still lead.
  const main = page.locator('.ids-search-results .hit .char').first()
  await main.waitFor()
  assert.equal(await main.textContent(), '霖')
  assert.deepEqual(errors, [])
  console.log('PASS similar structures sit under the structure matches, no mode of their own')
} finally { await browser.close() }
