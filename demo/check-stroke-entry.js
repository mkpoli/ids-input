// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-stroke-entry.js
// The dev server writes data/stroke-orders-entered.tsv; the check removes the row it saves.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const file = new URL('../data/stroke-orders-entered.tsv', import.meta.url)
const base = process.env.IDS_URL ?? 'http://localhost:5173'
const before = readFileSync(file, 'utf8')
// A private-use character: no source records it and nobody enters it, so the check owns its row.
const CHAR = '', row = new RegExp(`\\n${CHAR}\\tcns11643\\t`)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  assert.equal(row.test(before), false, 'the check\'s character is already entered')
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${base}/strokes.html?lang=en`, { waitUntil: 'networkidle' })
  await page.locator('tbody tr').first().waitFor()
  const order = page.getByLabel('Order', { exact: true }), basis = page.getByLabel('Basis', { exact: true })

  // Any character can be entered by typing it.
  await page.getByPlaceholder('Another character').fill(CHAR)
  assert.equal(await page.locator('.glyph').innerText(), CHAR)
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
  await page.getByRole('button', { name: `Remove ${CHAR}` }).waitFor()
  assert.match(readFileSync(file, 'utf8'), new RegExp(`\\n${CHAR}\\tcns11643\\t2\\t\\tmkpoli\\t\\d{4}-\\d{2}-\\d{2}\\n$`))

  // Saving again with a basis replaces the row.
  await basis.fill('browser check')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor()
  assert.match(readFileSync(file, 'utf8'), new RegExp(`\\n${CHAR}\\tcns11643\\t2\\tbrowser check\\tmkpoli\\t\\d{4}-\\d{2}-\\d{2}\\n$`))

  // What is being typed survives a row leaving the table.
  await basis.fill('still typing')
  await page.getByRole('button', { name: `Remove ${CHAR}` }).click()
  await page.locator('tbody tr', { hasText: 'browser check' }).waitFor({ state: 'detached' })
  assert.equal(readFileSync(file, 'utf8'), before)
  assert.equal(await basis.inputValue(), 'still typing')

  // A write from another site, or one that names no origin, is refused and writes nothing.
  const entry = { char: CHAR, source: 'cns11643', orders: '1', basis: 'x', by: 'x', date: '2026-01-01' }
  const foreign = await page.request.post(`${base}/api/stroke-entries`, { headers: { origin: 'https://example.com', 'content-type': 'application/json' }, data: entry })
  assert.equal(foreign.status(), 403)
  const unnamed = await fetch(`${base}/api/stroke-entries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) })
  assert.equal(unnamed.status, 403)
  assert.equal(readFileSync(file, 'utf8'), before)
  console.log('PASS the stroke-order page saves an entered order to the repository file')
} finally {
  await browser.close()
  // Whatever happened, the check's own row is taken out again; rows a person saved meanwhile stay.
  if (!row.test(before) && row.test(readFileSync(file, 'utf8'))) {
    await fetch(`${base}/api/stroke-entries`, { method: 'DELETE', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ char: CHAR, source: 'cns11643' }) })
  }
}
