// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-face-fallback.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const sequence = '⿱苦⿲⿰⿹耳舌鼻⿳⿸⿹平惡意眼⿰淨𭰏⿰⿱女子身'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const errors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-field input').fill(sequence)
  await page.getByRole('button', { name: 'Large view' }).click({ timeout: 120000 })
  await page.waitForSelector('dialog#large-preview[open]')
  await page.locator('dialog#large-preview').getByRole('button', { name: 'Kaisho' }).click()
  const note = page.locator('dialog#large-preview .ids-preview-fallback')
  await note.waitFor({ timeout: 120000 })
  assert.match((await note.textContent()) ?? '', /another face/, 'the fallback is explained')
  assert.ok(await page.locator('dialog#large-preview .ids-preview-large svg path').count(), 'a drawing is still shown')
  assert.deepEqual(errors, [])
  console.log('PASS a missing face falls back with a note')
} finally { await browser.close() }
