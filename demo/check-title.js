// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const open = async () => {
    await page.getByRole('menuitem', { name: 'File', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Document title…', exact: true }).click()
  }
  await open()
  const input = page.getByRole('dialog').getByLabel('Title')
  await input.fill('My document')
  if (process.env.IDS_TITLE_SHOTS) await page.getByRole('dialog').screenshot({ path: `${process.env.IDS_TITLE_SHOTS}/title.png` })
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(400)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.title), 'My document')
  assert.ok((await page.title()).startsWith('My document'), 'the page title follows the document title')
  await open()
  assert.equal(await page.getByRole('dialog').getByLabel('Title').inputValue(), 'My document')
  await page.getByRole('dialog').getByLabel('Title').fill('')
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(400)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.title), undefined)
  assert.deepEqual(errors, [])
  console.log('PASS document title saves, shows in the page title and clears')
} finally { await browser.close() }
