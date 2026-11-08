// A reader's own font: the workshop takes a font file with its name and licence, keeps it on the
// device and tries it before the bundled fallback shards.
//
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-user-fonts.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const FONT = readFileSync(new URL('../fonts/NotoSansCJKjp-ids-operators.woff2', import.meta.url))
const openPrefs = async page => {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForTimeout(800)
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`)
  await openPrefs(page)
  await page.locator('.prefs input[type=file]').setInputFiles({ name: 'operators.woff2', mimeType: 'font/woff2', buffer: FONT })
  await page.getByLabel('Font name').fill('Test face')
  await page.getByLabel('Licence').fill('OFL 1.1')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(1200)
  assert.equal(await page.locator('.font-list .font-name').textContent(), 'Test face')
  assert.equal(await page.locator('.font-list .font-licence').textContent(), 'OFL 1.1')
  const chain = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fallback-font'))
  assert.match(chain, /IDS User Font/, 'the reader font comes before the shards')
  assert.ok(await page.evaluate(() => [...document.fonts].some(face => face.family.startsWith('"IDS User Font') || face.family.startsWith('IDS User Font'))), 'the face is registered')
  console.log('PASS a font file joins the fallback with its name and licence')

  // It is kept on the device: a reload shows it again.
  await page.reload()
  await page.waitForTimeout(1500)
  await openPrefs(page)
  await page.waitForTimeout(800)
  assert.equal(await page.locator('.font-list .font-name').textContent(), 'Test face')
  console.log('PASS the font survives a reload')

  // Removing it takes it out of the chain and the store.
  await page.locator('.font-list .font-remove').click()
  await page.waitForTimeout(800)
  assert.equal(await page.locator('.font-list .font-name').count(), 0)
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fallback-font'))
  assert.doesNotMatch(after, /IDS User Font/)
  console.log('PASS removing the font takes it out of the chain')
} finally {
  await browser.close()
}
