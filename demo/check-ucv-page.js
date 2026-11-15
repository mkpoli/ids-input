// The IRG component variations have a reference page. Run against a devrun server:
//   IDS_URL=http://localhost:5173 bun demo/check-ucv-page.js
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

    // The reference page: an address names an entry; its forms and examples open in the workshop.
    await page.goto(`${url}/ucv.html?lang=en#ucv-321`, { waitUntil: 'networkidle' })
    const entry = page.locator('.ids-ucv-entry[data-entry="321"]')
    await entry.waitFor()
    assert.equal(await page.locator('.ids-ucv-entry').count(), 1)
    assert.equal(await entry.locator('.ids-ucv-form svg path').count(), 3)
    assert.match(await entry.locator('.ids-ucv-head').innerText(), /JIS 148/)
    assert.deepEqual(await entry.locator('.ids-ucv-char').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-character'))),
      ['爂', '爨', '釁', '爨', '\u{2F920}', '𦦝', '𦦧', '𦦞', '𦦡'])
    assert.match(await entry.locator('a.ids-ucv-char').first().getAttribute('href') ?? '', /ids=%E7%88%82$/)
    if (shots) await page.screenshot({ path: join(shots, `ucv-page-${scheme}.png`) })

    const search = page.locator('.ids-ucv input[type="search"]')
    await search.fill('213a')
    await page.locator('.ids-ucv-entry[data-entry="213a"]').waitFor()
    assert.equal(await page.locator('.ids-ucv-entry[data-entry="213a"] .ids-ucv-form').count(), 13, 'an entry that repeats a glyph draws every form')
    await search.fill('壬')
    await page.locator('.ids-ucv-entry[data-entry="1"]').waitFor()
    assert.equal(await page.locator('.ids-ucv-entry').first().getAttribute('data-entry'), '1')
    await search.fill('')
    await page.getByRole('button', { name: 'NUCV', exact: true }).click()
    await page.locator('.ids-ucv-entry[data-entry="264a"]').waitFor()
    assert.equal(await page.locator('.ids-ucv-entry').count(), 14)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS component variations: the reference page')
} finally { await browser.close() }
