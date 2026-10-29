// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-shuishu.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173')
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Shui script', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.evaluate(async () => { await document.fonts.load('22px "IDS Shuishu"', '\u{1B300}') })
  assert.equal(await page.evaluate(() => document.fonts.check('22px "IDS Shuishu"', '\u{1B300}')), true)

  // The groups: the dictionary's characters first, the radicals and the unnumbered characters by button.
  const groups = page.locator('.script-groups button')
  const texts = (await groups.allTextContents()).map(text => text.replace(/\s+/g, ' ').trim())
  assert.deepEqual(texts.map(text => text.replace(/ \d+$/, '')), ['Dictionary', 'Radicals', 'Other logograms'])
  const counts = texts.map(text => Number(text.match(/ (\d+)$/)?.[1]))
  assert.ok(counts.every(count => count > 0), 'each group has parts')
  await groups.nth(1).click()
  assert.equal(await page.locator('.parts-grid .part').count(), counts[1])
  await groups.nth(2).click()
  assert.equal(await page.locator('.parts-grid .part').count(), counts[2])
  await groups.nth(0).click()
  assert.equal(await page.locator('.parts-grid .part').count(), counts[0])

  const filter = page.locator('.parts-filter')
  for (const [query, count, first, name] of [
    ['QYED7-A', 1, '\u{1B300}', 'QYED7-A'],
    // A meaning also matches the longer meanings that contain it.
    ['一', 3, '\u{1B300}', '一'],
    ['ʔjət⁷', 4, '\u{1B300}', 'ʔjət⁷'],
    ['U+1B52E', 1, '\u{1B52E}', '43'],
  ]) {
    await filter.fill(query)
    assert.equal(await page.locator('.parts-grid .part').count(), count, query)
    const part = page.locator('.parts-grid .part').first()
    assert.equal(await part.getAttribute('data-character'), first, query)
    assert.match(await part.getAttribute('title'), new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), query)
  }

  await filter.fill('')
  const firstPart = page.locator('.parts-grid .part').first()
  await firstPart.click()
  const field = page.locator('.ids-field input')
  // The palette inserts after a short delay; wait for the part rather than race it.
  const clicked = await page.locator('.parts-grid .part').first().getAttribute('data-character')
  assert.ok(clicked, 'the first part carries its character')
  await page.waitForFunction(char => document.querySelector('.ids-field input')?.value.includes(char), clicked)
  const pieces = (await field.inputValue()).length
  assert.ok(pieces > 0, 'the part lands in the field')
  await field.fill('')
  await field.fill('⿰\u{1B300}\u{1B31A}')
  await page.waitForFunction(() => !document.querySelector('.ids-preview[aria-busy="true"]'))
  assert.notEqual(await field.getAttribute('aria-invalid'), 'true')
  assert.equal(await field.inputValue(), '⿰\u{1B300}\u{1B31A}')
  assert.ok(await page.locator('.ids-preview-large img, .ids-preview-large svg').count() > 0)
  assert.ok(pieces > 0)
  console.log('PASS Shuishu parts in the palette, filter and preview')
} finally { await browser.close() }
