// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { fromSequence, shareDocument } from '../src/document/index.js'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const base = process.env.IDS_URL ?? 'http://localhost:5186'
  const document = fromSequence('⿰木口')
  document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 14, 0] }]
  document.title = 'Shared document'
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/?doc=${shareDocument(document)}#%E2%BF%B0%E6%9C%A8%E5%8F%A3`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0])
  assert.equal(record?.document?.document?.title, 'Shared document')
  assert.deepEqual(record?.document?.document?.root?.children?.[0]?.transform?.[0]?.matrix, [1, 0, 0, 1, 14, 0])
  await page.getByRole('button', { name: 'Share', exact: true }).first().click()
  const link = await page.getByRole('dialog').locator('input').inputValue()
  assert.ok(link.includes('doc='), 'the share link carries the document')
  assert.deepEqual(errors, [])
  console.log('PASS shared document opens with its transform and the dialog shares it')
} finally { await browser.close() }
