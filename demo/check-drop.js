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
  const before = await page.locator('.tabbar [role="tab"]').count()
  await page.evaluate(() => {
    const record = JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]
    const document = record.document.document
    const transfer = new DataTransfer()
    transfer.items.add(new File([JSON.stringify(document)], 'dropped-one.ids.json', { type: 'application/json' }))
    transfer.items.add(new File([JSON.stringify(document)], 'dropped-two.ids.json', { type: 'application/json' }))
    window.__drop = transfer
    window.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }))
  })
  await page.locator('.drop-overlay.show').waitFor({ timeout: 5000 })
  await page.waitForTimeout(250)
  if (process.env.IDS_DROP_SHOTS) await page.screenshot({ path: `${process.env.IDS_DROP_SHOTS}/drop-${process.env.IDS_SCHEME ?? 'light'}.png` })
  await page.evaluate(() => window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__drop })))
  await page.waitForTimeout(800)
  assert.equal(await page.locator('.tabbar [role="tab"]').count(), before + 2)
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]').at(-1))
  assert.equal(record?.document?.document?.format, 'ids-input/document')
  assert.deepEqual(errors, [])
  console.log('PASS dropping several documents opens a tab each')
} finally { await browser.close() }
