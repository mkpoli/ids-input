// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-alphabet-parts.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage()
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173')
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Letters & numbers', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  assert.equal(await page.locator('.parts-grid .part').count(), 120)
  // The script palette grows with the bundled data; its page label is what is promised.
  const pages = await page.locator('.script-pages').innerText()
  assert.match(pages, /Page 1 of \d+ · [\d,]+ parts/)
  const total = Number(/([\d,]+) parts/.exec(pages)?.[1]?.replace(/,/g, ''))
  assert.ok(total > 2000, `unexpected palette size: ${pages}`)
  for (const [query, part] of [['A', 'A'], ['3', '3'], ['Ḁ', 'Ḁ'], ['ꙮ', 'ꙮ'], ['U+A66E', 'ꙮ']]) {
    await page.locator('.parts-filter').fill(query)
    assert.equal(await page.locator('.parts-grid .part').count(), 1, query)
    assert.equal(await page.locator('.parts-grid .part').first().getAttribute('data-character'), part)
  }
  console.log('PASS Latin and Cyrillic coverage, paging and search')
} finally { await browser.close() }
