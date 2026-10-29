// The Components tab pages the frequent set and every stroke group, like All characters.
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-component-pages.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(url)
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Components', exact: true }).click()
  const parts = page.locator('.parts-grid .part')
  const pager = page.locator('.script-pages')
  await parts.first().waitFor()
  assert.equal(await parts.count(), 120, 'the frequent set is paged')
  assert.match(await pager.innerText(), /1 of 7 · 772 parts/)
  const first = await parts.first().innerText()
  await pager.getByRole('button', { name: 'Next', exact: true }).click()
  assert.match(await pager.innerText(), /2 of 7/)
  assert.notEqual(await parts.first().innerText(), first, 'the next page starts elsewhere')
  await page.getByRole('button', { name: '8 strokes', exact: true }).click()
  assert.match(await pager.innerText(), /1 of 9 · 1,017 parts/)
  await pager.getByRole('button', { name: 'Next', exact: true }).click()
  assert.match(await pager.innerText(), /2 of 9/)
  await page.getByRole('button', { name: '23 strokes and up', exact: true }).click()
  assert.equal(await parts.count(), 107, 'the tail fits one page')
  assert.equal(await pager.count(), 0, 'a single page has no pager')
  await page.locator('.parts-filter').fill('木')
  assert.ok(await parts.count() > 0, 'a filter still finds parts across the set')
  assert.equal(await pager.count(), 0, 'a search result shows without its pager')
  await page.locator('.parts-filter').fill('')
  await page.getByRole('button', { name: 'Common', exact: true }).click()
  assert.match(await pager.innerText(), /1 of 7 · 772 parts/)
  console.log('PASS Components pages the frequent set and each stroke group')
} finally { await browser.close() }
