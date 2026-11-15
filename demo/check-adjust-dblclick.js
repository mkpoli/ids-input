// A double-click on the output drawing starts direct editing, where the Adjust layout button is
// available and only there. Run against a local dev server with IDS_URL set:
//   IDS_URL=http://localhost:5186 CHROMIUM_PATH=/path/to/chrome bun demo/check-adjust-dblclick.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    // The button keeps its place and its aria-pressed state while its label switches to Done.
    const adjust = page.locator('.adjust button[aria-pressed]')
    const drawing = page.locator('.ids-preview-large')
    const field = page.locator('.ids-field input')
    await field.fill('⿰木口')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 60000 })
    assert.equal(await adjust.isDisabled(), false, 'the drawing can be adjusted')
    assert.equal(await adjust.textContent(), 'Adjust layout')

    // One click leaves the drawing alone, and so does a double-click on the caption, which keeps
    // its own text selection.
    await drawing.click()
    await page.waitForTimeout(300)
    assert.equal(await adjust.getAttribute('aria-pressed'), 'false', 'a single click leaves editing alone')
    await page.locator('.ids-preview-meta').dblclick()
    await page.waitForTimeout(300)
    assert.equal(await adjust.getAttribute('aria-pressed'), 'false', 'a double-click on the caption leaves editing alone')

    if (process.env.IDS_ADJUST_SHOTS) {
      mkdirSync(process.env.IDS_ADJUST_SHOTS, { recursive: true })
      await page.locator('#output-panel').screenshot({ path: `${process.env.IDS_ADJUST_SHOTS}/dblclick-before-${scheme}.png` })
    }
    await drawing.dblclick()
    await page.locator('.ids-preview[data-adjusting="true"]').waitFor({ timeout: 10000 })
    assert.equal(await adjust.getAttribute('aria-pressed'), 'true', 'the double-click turns editing on')
    assert.equal(await adjust.textContent(), 'Done')
    await page.locator('.ids-preview-large svg[role="application"]').waitFor({ timeout: 10000 })
    if (process.env.IDS_ADJUST_SHOTS) {
      await page.locator('#output-panel').screenshot({ path: `${process.env.IDS_ADJUST_SHOTS}/dblclick-after-${scheme}.png` })
    }

    // A second double-click while editing does not close it; Done does.
    await drawing.dblclick()
    await page.waitForTimeout(300)
    assert.equal(await adjust.getAttribute('aria-pressed'), 'true', 'a double-click while editing keeps it on')

    await adjust.click()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.ids-preview[data-adjusting]').count(), 0, 'Done closes editing')

    // Nothing to adjust: the button stays disabled and the gesture does nothing.
    await field.fill('')
    await field.press('Tab')
    await page.waitForFunction(() => document.querySelector('.adjust button[aria-pressed]')?.disabled === true, null, { timeout: 10000 })
    assert.equal(await adjust.isDisabled(), true, 'an empty output cannot be adjusted')
    await drawing.dblclick()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.ids-preview[data-adjusting]').count(), 0, 'a double-click without a drawing starts nothing')
    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: double-click starts and keeps direct editing, only when available`)
    await page.close()
  }
} finally {
  await browser.close()
}
