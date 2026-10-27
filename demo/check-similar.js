// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-similar.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.fill('⿱木口')
  await page.getByRole('button', { name: 'Similar structures', exact: true }).click()
  const results = page.locator('.ids-search-results .hit .char')
  await results.first().waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.ids-search-results .hit .char').length >= 2)
  const chars = await results.allTextContents()
  // 森 and 李 share 木 on top, 占 shares 口; 杏 is the description itself and stays out.
  assert.ok(chars.includes('森'), `森 missing from ${chars}`)
  assert.ok(chars.includes('李'), `李 missing from ${chars}`)
  assert.ok(chars.includes('占'), `占 missing from ${chars}`)
  assert.ok(!chars.includes('杏'), `the description's own character is listed: ${chars}`)
  // The other modes still work after switching.
  await page.getByRole('button', { name: 'Characters with this structure', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.ids-search-results .hit .char').length > 0)
  assert.ok((await page.locator('.ids-search-results .hit .char').allTextContents()).includes('杏'))
  assert.deepEqual(errors, [])
  console.log('PASS similar structures list the characters sharing one operand, and the description\'s own stays out')
} finally { await browser.close() }
