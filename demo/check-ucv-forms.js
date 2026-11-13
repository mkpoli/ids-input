// A chosen component lists the forms the IRG unifies with it beside its other alternatives. Run
// against a devrun server:
//   IDS_URL=http://localhost:5173 bun demo/check-ucv-forms.js
// IDS_SHOTS names a folder to write screenshots into.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { join } from 'node:path'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
const shots = process.env.IDS_SHOTS
try {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    page.setDefaultNavigationTimeout(120000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    // The picker keeps its four tabs.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('⿰氵壬')}`, { waitUntil: 'networkidle' })
    assert.deepEqual(await page.locator('.ids-pick-tabs [role="tab"]').allInnerTexts(), ['Parts', 'Templates', 'Take parts from', 'Find'])

    // A chosen component with unifiable forms lists them beside its other alternatives.
    await page.locator('.ids-tree .ids-part').nth(1).click()
    const row = page.locator('.ids-swaps .ids-unified[data-ucv="1"]')
    await row.waitFor()
    await row.locator('svg path').first().waitFor()
    assert.equal(await row.locator('.ids-unified-entry').innerText(), 'UCV 1')
    assert.match(await row.locator('.ids-unified-entry').getAttribute('href') ?? '', /ucv\.html\?lang=en#ucv-1$/)
    assert.deepEqual(await row.locator('button.ids-unified-form').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-form'))), ['u738b', 'u2123c'])
    assert.equal(await row.locator('span.ids-unified-form').count(), 1, 'the form with no text of its own is shown, not offered')
    if (shots) { await page.screenshot({ path: join(shots, `ucv-part-${scheme}.png`) }); await page.locator('.ids-swaps').screenshot({ path: join(shots, `ucv-alternatives-${scheme}.png`) }) }
    await row.locator('button.ids-unified-form[data-form="u738b"]').click()
    await page.waitForFunction(() => /** @type {HTMLInputElement | null} */ (document.querySelector('.ids-field input'))?.value === '⿰氵王')

    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS component variations: unifiable forms beside the chosen part')
} finally { await browser.close() }
