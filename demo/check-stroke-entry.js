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
  const order = page.getByLabel('Order', { exact: true }).last()
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

  await page.locator('tbody tr', { hasText: 'browser check' }).getByRole('button', { name: 'Remove' }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor({ state: 'detached' })
  assert.equal(readFileSync(file, 'utf8'), before)
  console.log('PASS the stroke-order page saves an entered order to the repository file')
} finally {
  await browser.close()
  // Whatever happened, the file is left as it was found.
  if (readFileSync(file, 'utf8') !== before) (await import('node:fs')).writeFileSync(file, before)
}
