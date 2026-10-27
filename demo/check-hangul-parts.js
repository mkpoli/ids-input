// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-hangul-parts.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage()
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173')
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('tab', { name: 'Hangul', exact: true }).click()
  const select = page.getByRole('combobox', { name: 'Hangul parts' })
  await page.locator('.parts-grid .part').first().waitFor()
  const filter = page.locator('.parts-filter')
  for (const part of ['◇', 'ᄓ', '㉠', '〮']) {
    await filter.fill(part)
    assert.equal(await page.locator('.parts-grid .part').count(), 1, part)
    assert.equal(await page.locator('.parts-grid .part').first().getAttribute('data-character'), part)
  }
  await select.selectOption('syllables')
  assert.equal(await page.locator('.parts-grid .part').count(), 120)
  assert.equal(await page.locator('.parts-grid .part').first().getAttribute('data-character'), '가')
  assert.match(await page.locator('.script-pages').innerText(), /11,?172/)
  await filter.fill('U+D7A3')
  assert.equal(await page.locator('.parts-grid .part').count(), 1)
  assert.equal(await page.locator('.parts-grid .part').first().getAttribute('data-character'), '힣')
  await filter.fill('가')
  assert.equal(await page.locator('.parts-grid .part').first().getAttribute('data-character'), '가')
  const fixture = await browser.newPage()
  await fixture.goto(new URL('/fixtures/hangul-parts.html', process.env.IDS_URL ?? 'http://localhost:5173').href)
  await fixture.getByRole('tab', { name: 'Hangul', exact: true }).click()
  for (const query of ['42', 'hangul-alias']) {
    await fixture.locator('.parts-filter').fill(query)
    assert.equal(await fixture.locator('.parts-grid .part').count(), 1)
    assert.equal(await fixture.locator('.parts-grid .part').first().getAttribute('data-character'), 'ㅏ')
  }
  await fixture.close()
  console.log('PASS Hangul letters, historical marks, syllables, paging and search')
} finally { await browser.close() }
