// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-chain-entry.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  // A zi.tools description with a stroke chain this package cannot draw resolves to 乌.
  await field.fill('⿱丿⿹#(-𠃌㇉)一')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '乌')
  assert.equal(await field.getAttribute('aria-invalid'), 'false')
  // The same description without a known character stays in the field as typed.
  await field.fill('⿱丿⿹#(ZZZ)一')
  await page.waitForTimeout(800)
  assert.equal(await field.inputValue(), '⿱丿⿹#(ZZZ)一')
  assert.equal(await field.getAttribute('aria-invalid'), 'true')
  assert.deepEqual(errors, [])
  console.log('PASS a chain description resolves to 乌, an unknown chain stays text')
} finally { await browser.close() }
