// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-stroke-entry.js
// The dev server writes data/stroke-orders-entered.tsv; the check removes the row it saves.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const file = new URL('../data/stroke-orders-entered.tsv', import.meta.url)
const before = readFileSync(file, 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/strokes.html?lang=en`, { waitUntil: 'networkidle' })
  await page.locator('.wanted').first().waitFor()
  await page.locator('.where', { hasText: 'Repository' }).waitFor()

  // 龹 is wanted for CNS; Rime records it, and its order can be taken as a start.
  await page.locator('.wanted', { hasText: '龹' }).click()
  assert.equal(await page.locator('.glyph').innerText(), '龹')
  await page.locator('.known button').first().click()
  const order = page.getByLabel('Order', { exact: true })
  assert.equal(await order.inputValue(), '431134')
  // The keys write the same digits; a second way follows a space.
  await page.locator('.keys button[title="Another way"]').click()
  await page.locator('.keys .key').nth(3).click()
  assert.equal(await order.inputValue(), '431134 4')
  await page.locator('.keys button[title="Backspace"]').click()
  await page.locator('.keys button[title="Backspace"]').click()
  assert.equal(await order.inputValue(), '431134')

  // A row without a basis is refused, and nothing is written.
  await page.getByLabel('Entered by').fill('check')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.locator('.ui-error', { hasText: 'A basis is required' }).waitFor()
  assert.equal(readFileSync(file, 'utf8'), before)

  await page.getByLabel('Basis', { exact: true }).fill('browser check')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor()
  assert.match(readFileSync(file, 'utf8'), /\n龹\tcns11643\t431134\tbrowser check\tcheck\t\d{4}-\d{2}-\d{2}\n$/)
  // The queue marks it done and moves on to a component still open.
  assert.equal(await page.locator('.wanted.done', { hasText: '龹' }).count(), 1)
  assert.notEqual(await page.locator('.glyph').innerText(), '龹')

  // What is being typed for another component survives a row leaving the table.
  await page.getByLabel('Basis', { exact: true }).fill('still typing')
  await page.locator('tbody tr', { hasText: 'browser check' }).getByRole('button', { name: 'Remove 龹' }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor({ state: 'detached' })
  assert.equal(readFileSync(file, 'utf8'), before)
  assert.equal(await page.getByLabel('Basis', { exact: true }).inputValue(), 'still typing')
  // A request from another site is refused and writes nothing.
  const foreign = await page.request.post(`${process.env.IDS_URL ?? 'http://localhost:5173'}/api/stroke-entries`, { headers: { origin: 'https://example.com', 'content-type': 'application/json' }, data: { char: '龹', source: 'cns11643', orders: '1', basis: 'x', by: 'x', date: '2026-01-01' } })
  assert.equal(foreign.status(), 403)
  assert.equal(readFileSync(file, 'utf8'), before)
  console.log('PASS the stroke-order page saves an entered order to the repository file')
} finally {
  await browser.close()
  // Whatever happened, the check's own row is taken out again; rows a person saved meanwhile stay.
  if (readFileSync(file, 'utf8').includes('\tbrowser check\tcheck\t')) {
    await fetch(`${process.env.IDS_URL ?? 'http://localhost:5173'}/api/stroke-entries`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ char: '龹', source: 'cns11643' }) })
  }
}
