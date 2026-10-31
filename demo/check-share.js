// Run against a local devrun server with IDS_URL.
// A sequence travels in the path; a fragment and a whole-document token still open. Both kinds of
// share link say what they must: the sequence alone for an untouched document, a short token
// otherwise.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { fromSequence, writeDocument } from '../src/document/index.js'
const legacy = document => Buffer.from(writeDocument(document), 'utf8').toString('base64url')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const base = process.env.IDS_URL ?? 'http://localhost:5186'
  const document = fromSequence('⿰木口')
  document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 14, 0] }]
  document.title = 'Shared document'
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/?doc=${legacy(document)}#%E2%BF%B0%E6%9C%A8%E5%8F%A3`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0])
  assert.equal(record?.document?.document?.title, 'Shared document')
  assert.deepEqual(record?.document?.document?.root?.children?.[0]?.transform?.[0]?.matrix, [1, 0, 0, 1, 14, 0])
  await page.getByRole('button', { name: 'Share', exact: true }).first().click()
  const link = await page.getByRole('dialog').locator('input').inputValue()
  assert.ok(link.includes('doc='), 'the share link carries the difference')
  assert.equal(new URL(link).pathname, '/%E2%BF%B0%E6%9C%A8%E5%8F%A3', 'the sequence is the path')
  assert.ok(link.length < 260, `the share link stays short: ${link.length}`)
  const reopened = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  reopened.on('pageerror', error => errors.push(error.message))
  await reopened.goto(link, { waitUntil: 'domcontentloaded' })
  await reopened.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  const again = await reopened.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0])
  assert.equal(again?.document?.document?.title, 'Shared document')
  assert.deepEqual(again?.document?.document?.root?.children?.[0]?.transform?.[0]?.matrix, [1, 0, 0, 1, 14, 0])
  const tabs = () => reopened.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]').length)
  for (let visit = 0; visit < 2; visit++) {
    await reopened.reload({ waitUntil: 'domcontentloaded' })
    await reopened.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
    assert.equal(await tabs(), 1, 'a reload of the link keeps its one tab')
  }
  const untouched = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  untouched.on('pageerror', error => errors.push(error.message))
  await untouched.goto(`${base}/%E2%BF%BA%E7%94%B5%E5%B0%BC`, { waitUntil: 'domcontentloaded' })
  await untouched.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  await untouched.getByRole('button', { name: 'Share', exact: true }).first().click()
  const plain = await untouched.getByRole('dialog').locator('input').inputValue()
  assert.equal(new URL(plain).search, '', `an untouched document shares its sequence alone: ${plain}`)
  assert.equal(new URL(plain).pathname, '/%E2%BF%BA%E7%94%B5%E5%B0%BC', 'and keeps it in the path')
  assert.deepEqual(errors, [])
  console.log('PASS a whole-document token opens, the shared link reopens with its transform in the path, an untouched example shares its path alone')
} finally { await browser.close() }
