// A focused part copies itself with one keystroke: Ctrl/Cmd+C on a part button puts its character on
// the clipboard, where before it only selected the text and waited for a second press.
//
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-palette-copy.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
try {
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.addInitScript(() => {
    const copied = []
    window.__copied = copied
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: text => { copied.push(text); return Promise.resolve() } },
      configurable: true,
    })
  })
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`)
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.waitForTimeout(1500)
  const part = page.locator('.parts-grid .part').nth(1)
  const character = (await part.locator('.part-text').textContent())?.trim()
  await part.focus()
  await page.keyboard.press('Control+c')
  await page.waitForTimeout(300)
  const copied = await page.evaluate(() => window.__copied)
  assert.deepEqual(copied, [character], 'the focused part lands on the clipboard in one keystroke')
  console.log(`PASS ${character} copies with one keystroke`)
  // Ctrl+A copies the page of parts, without the pager and the stroke counts around it.
  await part.focus()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+c')
  await page.waitForTimeout(400)
  const bulk = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  assert.match(bulk, /口/, 'the page of parts is selected')
  assert.doesNotMatch(bulk, /Previous|Next|Page \d/, 'the pager stays out of the selection')
  console.log('PASS the page of parts selects without the pager')

  // An http origin has no clipboard object: the key selects the part, so the browser copies it.
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }) })
  await part.focus()
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  await page.keyboard.press('Control+c')
  await page.waitForTimeout(300)
  const fallback = await page.evaluate(() => window.getSelection()?.toString())
  assert.equal(fallback, character, 'without a clipboard the part is selected for the browser to copy')
  console.log('PASS without a clipboard the part is selected')
} finally {
  await browser.close()
}
