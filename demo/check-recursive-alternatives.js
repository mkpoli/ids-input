// Run against a served demo: IDS_URL=http://127.0.0.1:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-recursive-alternatives.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: process.env.IDS_DARK ? 'dark' : 'light' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${url}/?ids=${encodeURIComponent('⿰吋吋')}`, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.waitFor()
  await page.locator('.ids-tree .ids-op').first().click()
  await field.focus()
  const choices = page.locator('.ids-options button')
  const left = choices.getByText('⿰⿰口寸吋', { exact: true })
  const right = choices.getByText('⿰吋⿰口寸', { exact: true })
  const both = choices.getByText('⿰⿰口寸⿰口寸', { exact: true })
  await left.waitFor({ timeout: 120000 })
  await right.waitFor({ timeout: 120000 })
  await both.waitFor({ timeout: 120000 })
  if (process.env.IDS_SHOT) {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: process.env.IDS_SHOT })
  }
  await both.click()
  assert.equal(await field.inputValue(), '⿰⿰口寸⿰口寸', 'a combination replaces the chosen node')
  await page.locator('.toast button').click()
  assert.equal(await field.inputValue(), '⿰吋吋', 'the replacement is undoable')

  await page.goto(`${url}/?ids=${encodeURIComponent('⿰⿰口寸⿰口寸')}`, { waitUntil: 'domcontentloaded' })
  await field.waitFor()
  await page.locator('.ids-tree .ids-op').first().click()
  await field.focus()
  const compressed = page.locator('.ids-options button').getByText('⿰吋吋', { exact: true })
  await compressed.waitFor({ timeout: 120000 })
  await compressed.click()
  assert.equal(await field.inputValue(), '⿰吋吋', 'both nested nodes can be merged together')
  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS recursive alternatives include independent and combined expansions and are undoable')
} finally { await browser.close() }
