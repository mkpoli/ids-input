// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-jurchen.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173')
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Jurchen', exact: true }).click()
  const tiles = page.locator('.parts-grid .part')
  await tiles.first().waitFor()
  await page.evaluate(async () => { await document.fonts.load('22px "IDS Jurchen"', '\u{18E00}') })
  assert.equal(await page.evaluate(() => document.fonts.check('22px "IDS Jurchen"', '\u{18E00}')), true)

  const groups = page.locator('.script-groups button')
  const texts = (await groups.allTextContents()).map(text => text.replace(/\s+/g, ' ').trim())
  assert.deepEqual(texts, ['Characters 914', 'Variant forms 537', 'Radicals 51'])
  assert.equal(await tiles.count(), 914)

  // The radical row: all, then the 51 radicals drawn as glyphs.
  const radicals = page.locator('.jurchen-radicals button')
  assert.equal(await radicals.count(), 52)
  assert.equal(await radicals.nth(1).textContent(), '\u{191A0}')
  await radicals.nth(1).click()
  const narrowed = await tiles.count()
  assert.ok(narrowed > 0 && narrowed < 914, 'a radical narrows the characters')
  await radicals.nth(0).click()
  await groups.nth(2).click()
  assert.equal(await tiles.count(), 51)
  await groups.nth(1).click()
  assert.equal(await tiles.count(), 537)
  // A variant draws as its own glyph in text, and a Han selector sequence stays with its own face.
  const widths = await page.evaluate(async () => {
    const paint = text => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 64
      const context = canvas.getContext('2d')
      context.font = '48px "IDS Jurchen"'
      context.fillText(text, 4, 50)
      return [...context.getImageData(0, 0, 64, 64).data].join()
    }
    await document.fonts.load('48px "IDS Jurchen"', '\u{18E01}\uFE00')
    return { base: paint('\u{18E01}'), variant: paint('\u{18E01}\uFE00') }
  })
  assert.notEqual(widths.base, widths.variant, 'the selector reaches the face')
  await groups.nth(0).click()

  const filter = page.locator('.parts-filter')
  for (const [query, first, text] of [
    ['U+18E01', '\u{18E01}', 'tumən'],
    ['tumen', '\u{18E01}', 'tumən'],
    ['10000', '\u{18E01}', '10000'],
    ['hhz', '\u{18E00}', 'hhz'],
  ]) {
    await filter.fill(query)
    const part = tiles.first()
    assert.equal(await part.getAttribute('data-character'), first, query)
    assert.ok((await part.getAttribute('title')).includes(text), query)
    assert.equal(await part.getAttribute('lang'), 'juc')
  }

  // A picked part goes into the field, and a description of two draws from the bundled outlines.
  await filter.fill('')
  const field = page.locator('.ids-field input')
  await field.click()
  await field.fill('')
  await tiles.first().click()
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '\u{18E00}')
  await field.fill('⿰\u{18E00}\u{18E01}')
  await page.waitForFunction(() => !document.querySelector('.ids-preview[aria-busy="true"]'))
  assert.notEqual(await field.getAttribute('aria-invalid'), 'true')
  assert.ok(await page.locator('.ids-preview-large img, .ids-preview-large svg').count() > 0)
  console.log('PASS Jurchen parts in the palette, filter and preview')
} finally {
  await browser.close()
}
