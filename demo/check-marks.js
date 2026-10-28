// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-marks.js
// Loose marks after a description: typed, picked from the palette, undone, and left out of search.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 })
  // The Bopomofo preview draws from bundled outlines, so the check needs no host export.
  await page.route('https://glyphatlas.org/**', route => route.abort())
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  const atEnd = async () => {
    await field.focus()
    await field.evaluate(f => f.setSelectionRange(f.value.length, f.value.length))
  }
  const text = () => field.inputValue()
  const fault = async () => (await page.locator('.ids-field [aria-invalid="true"]').count()) > 0

  await field.fill('⿰木日')
  const hits = page.locator('.ids-search-results .hit')
  await hits.first().waitFor({ timeout: 30000 })
  const plainHits = await hits.count()
  await atEnd()
  await page.keyboard.insertText('ˊ')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰木日ˊ')
  assert.equal(await text(), '⿰木日ˊ')
  assert.equal(await fault(), false)
  // A search for the marked description finds the unmarked shape.
  await page.waitForFunction(count => document.querySelectorAll('.ids-search-results .hit').length === count,
    plainHits, { timeout: 15000 })
  assert.ok(plainHits > 0)

  // Backspace removes the mark, leaving the description whole.
  await field.fill('⿰木日')
  await atEnd()
  await page.keyboard.insertText('ˇ')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰木日ˇ')
  await page.keyboard.press('Backspace')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰木日')

  // A mark picked from the Marks palette annotates the whole description.
  await field.fill('⿰ㄅㄚ')
  await page.getByRole('tab', { name: 'Marks' }).click()
  await page.locator('.parts-panel .part[data-character="ˊ"]').first().click()
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰ㄅㄚˊ')
  assert.equal(await text(), '⿰ㄅㄚˊ')
  // Undo takes it away again.
  await field.focus()
  await page.keyboard.press('Control+z')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰ㄅㄚ')

  // A marked description draws as a whole, not as extra operands.
  await field.fill('⿰ㄅㄚˇ')
  await page.waitForTimeout(800)
  assert.match(await text(), /^⿰ㄅㄚˇ$/)
  assert.equal(await fault(), false)
  if (process.env.IDS_MARKS_SHOTS) {
    const { mkdirSync } = await import('node:fs')
    mkdirSync(process.env.IDS_MARKS_SHOTS, { recursive: true })
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.waitForTimeout(300)
      await page.locator('.ids-preview').screenshot({ path: `${process.env.IDS_MARKS_SHOTS}/marks-${scheme}.png` })
    }
  }
  assert.deepEqual(errors, [])
  console.log('marks: ok')
} finally {
  await browser.close()
}
