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
  await page.locator('tbody tr').first().waitFor()

  // ⺛ is read inside the characters written with 旡, and the reading can be taken with its basis.
  const order = page.getByLabel('Order', { exact: true }), basis = page.getByLabel('Basis', { exact: true })
  await page.locator('.wanted', { hasText: '⺛' }).click()
  assert.equal(await page.locator('.glyph').innerText(), '⺛')
  await page.locator('.ways button').first().click()
  assert.equal(await order.inputValue(), '1535')
  assert.equal(await basis.inputValue(), '33 of 33 characters with 旡, cns11643')

  // 〡 is wanted and nothing reads it. The check saves a row for it, so it stops where a person already has.
  assert.equal(/\n〡\tcns11643\t/.test(before), false, '〡 is entered: the check would overwrite it')
  await page.locator('.wanted', { hasText: '〡' }).click()
  assert.equal(await page.locator('.glyph').innerText(), '〡')
  assert.equal(await order.inputValue(), '')
  // The keys write the digits; a second way follows a space.
  await page.locator('.keys .key').nth(1).click()
  await page.locator('.keys button[title="Another way"]').click()
  await page.locator('.keys .key').nth(3).click()
  assert.equal(await order.inputValue(), '2 4')
  await page.locator('.keys button[title="Backspace"]').click()
  await page.locator('.keys button[title="Backspace"]').click()
  assert.equal(await order.inputValue(), '2')

  // An order in other symbols is refused, and nothing is written.
  await order.fill('hs')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.locator('.ui-error', { hasText: 'Digits 1–5' }).waitFor()
  assert.equal(readFileSync(file, 'utf8'), before)
  await order.fill('2')

  // The basis may be left out, and the row is the maintainer's.
  await page.getByRole('button', { name: 'Save' }).click()
  await page.locator('tbody tr', { hasText: '〡' }).waitFor()
  assert.match(readFileSync(file, 'utf8'), /\n〡\tcns11643\t2\t\tmkpoli\t\d{4}-\d{2}-\d{2}\n$/)
  await page.locator('.wanted', { hasText: '〡' }).first().click()

  await basis.fill('browser check')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor()
  assert.match(readFileSync(file, 'utf8'), /\n〡\tcns11643\t2\tbrowser check\tmkpoli\t\d{4}-\d{2}-\d{2}\n$/)
  // The queue marks it done and moves on to a character still open.
  assert.equal(await page.locator('.wanted.done', { hasText: '〡' }).count(), 1)
  assert.notEqual(await page.locator('.glyph').innerText(), '〡')

  // What is being typed for another character survives a row leaving the table.
  await basis.fill('still typing')
  await page.locator('tbody tr', { hasText: 'browser check' }).getByRole('button', { name: 'Remove 〡' }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor({ state: 'detached' })
  assert.equal(readFileSync(file, 'utf8'), before)
  assert.equal(await basis.inputValue(), 'still typing')
  // A request from another site is refused and writes nothing.
  const foreign = await page.request.post(`${process.env.IDS_URL ?? 'http://localhost:5173'}/api/stroke-entries`, { headers: { origin: 'https://example.com', 'content-type': 'application/json' }, data: { char: '〡', source: 'cns11643', orders: '1', basis: 'x', by: 'x', date: '2026-01-01' } })
  assert.equal(foreign.status(), 403)
  assert.equal(readFileSync(file, 'utf8'), before)
  console.log('PASS the stroke-order page saves an entered order to the repository file')
} finally {
  await browser.close()
  // Whatever happened, the check's own row is taken out again; rows a person saved meanwhile stay.
  if (!/\n〡\tcns11643\t/.test(before) && /\n〡\tcns11643\t/.test(readFileSync(file, 'utf8'))) {
    await fetch(`${process.env.IDS_URL ?? 'http://localhost:5173'}/api/stroke-entries`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ char: '〡', source: 'cns11643' }) })
  }
}
