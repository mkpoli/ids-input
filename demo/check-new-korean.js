// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-new-korean.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173')
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Hangul', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.evaluate(async () => { await document.fonts.load('22px "IDS New Korean"', '\u{A97D}') })
  assert.equal(await page.evaluate(() => document.fonts.check('22px "IDS New Korean"', '\u{A97D}')), true)
  const filter = page.locator('.parts-filter')
  for (const [query, count, first, name] of [
    ['여린리을', 2, '\u{A97D}', '여린리을'],
    ['U+A97D', 1, '\u{A97D}', '여린리을'],
    ['된리을', 2, '\u{A97E}', '된리을'],
    ['위읍', 2, '\u{A97F}', '위읍'],
    ['여린이', 1, '\u{D7C7}', '여린이'],
    ['반시읏', 3, '\u{317F}', '반시읏'],
    ['여린히읗', 3, '\u{3186}', '여린히읗'],
  ]) {
    await filter.fill(query)
    assert.equal(await page.locator('.parts-grid .part').count(), count, query)
    const part = page.locator('.parts-grid .part').first()
    assert.equal(await part.getAttribute('data-character'), first, query)
    assert.match(await part.getAttribute('title'), new RegExp(name), query)
  }
  const field = page.locator('.ids-field input')
  await field.fill('⿰\u{A97D}\u{A97E}')
  await page.waitForFunction(() => !document.querySelector('.ids-preview[aria-busy="true"]'))
  assert.notEqual(await field.getAttribute('aria-invalid'), 'true')
  assert.ok(await page.locator('.ids-preview-large img, .ids-preview-large svg').count() > 0)
  assert.equal(await field.inputValue(), '⿰\u{A97D}\u{A97E}')
  console.log('PASS New Korean Orthography letters in the Hangul palette and preview')
} finally { await browser.close() }
