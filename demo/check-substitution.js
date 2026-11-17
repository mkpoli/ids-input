// Run against a local devrun server: IDS_URL=http://localhost:5283 CHROMIUM_PATH=... bun demo/check-substitution.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5283', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  const tree = page.locator('.ids-tree')
  await field.fill('🔄[1]喵H十喵')
  await page.waitForFunction(() => document.querySelector('.ids-tree')?.textContent?.includes('⿰口⿱⿰十喵田'), undefined, { timeout: 30000 })
  assert.equal(await field.inputValue(), '🔄[1]喵H十喵', 'the field keeps the expression')
  assert.equal(await field.getAttribute('aria-invalid'), 'false', 'the resolved expression is not a fault')
  const at = '🔄[1]喵H十喵'.indexOf('[1]')
  await field.evaluate((element, start) => { element.focus(); element.setSelectionRange(start, start + 3) }, at)
  await page.keyboard.insertText('[0]')
  await page.waitForFunction(() => document.querySelector('.ids-tree')?.textContent?.includes('⿰口⿱⿰喵十田'), undefined, { timeout: 30000 })
  assert.equal(await field.inputValue(), '🔄[0]喵H十喵', 'the field keeps the edited expression')
  await page.keyboard.press('Control+z')
  await page.waitForFunction(() => document.querySelector('.ids-tree')?.textContent?.includes('⿰口⿱⿰十喵田'), undefined, { timeout: 30000 })
  assert.equal(await field.inputValue(), '🔄[1]喵H十喵', 'undo restores the expression')
  assert.ok(await tree.isVisible(), 'the tree shows the resolved item')
  console.log('PASS substitution keeps the expression while the tree shows the result')
} finally { await browser.close() }
