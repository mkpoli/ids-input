// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  // A phone layout, as on the iPhone the PNG copy failed from, where the output is its own tab.
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ja-JP', permissions: ['clipboard-read', 'clipboard-write'] })
  // What each ClipboardItem was built from: a blob the page finished first, or a promise it left.
  await page.addInitScript(() => {
    window.__items = []
    const Original = window.ClipboardItem
    window.ClipboardItem = class extends Original {
      constructor(data, options) {
        // The MIME types and the promise or blob behind each, before the item is built.
        const shape = Object.fromEntries(Object.entries(data ?? {}).map(([type, value]) => [type, typeof value?.then === 'function' ? 'promise' : 'blob']))
        super(data, options)
        window.__items.push(shape)
      }
    }
  })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input').first()
  await field.fill('⿰木木')
  await field.press('Tab')
  await page.locator('.ids-preview[data-step="composed"]').first().waitFor({ state: 'attached', timeout: 30000 })
  await page.locator('#phone-output-tab').click()
  await page.getByRole('radio', { name: 'PNG', exact: true }).click()

  await page.getByRole('button', { name: /^PNGをコピー$/ }).click()
  await page.waitForTimeout(3000)
  assert.deepEqual(await page.evaluate(() => window.__items), [{ 'image/png': 'promise' }],
    'the PNG is still a promise when write() runs: WebKit drops the click activation at an await before it')
  const copied = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read()
    const blob = await item.getType('image/png')
    return { types: item.types.join(','), size: blob.size, magic: [...new Uint8Array(await blob.slice(0, 4).arrayBuffer())].join(',') }
  })
  assert.equal(copied.types, 'image/png', 'a PNG reached the clipboard')
  assert.equal(copied.magic, '137,80,78,71', 'the clipboard PNG has the PNG signature')
  assert.ok(copied.size > 1000, 'the clipboard PNG has its pixels')
  console.log('PASS PNG copy hands the clipboard a promise, which settles into the PNG')
} finally { await browser.close() }
