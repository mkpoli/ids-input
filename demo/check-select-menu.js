// Checks the design system's select menu in a browser: the trigger, listbox, keyboard, selection,
// focus return and the disabled option. Run against a dev server:
//
//   IDS_URL=http://localhost:5186 CHROMIUM_PATH=/path/to/chrome bun demo/check-select-menu.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const base = (process.env.IDS_URL ?? 'http://localhost:5186').replace(/\/$/, '')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/design.html`, { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: /A custom select/ })
  await trigger.waitFor({ timeout: 60000 })
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'listbox')

  // ArrowDown opens and puts the selected option in focus.
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  const list = page.getByRole('listbox', { name: 'A custom select' })
  await list.waitFor({ state: 'visible' })
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'option')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-selected')), 'true')

  // Arrows move, Enter chooses, and focus comes back to the trigger.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  assert.match(await trigger.innerText(), /Compact/)
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-expanded')), 'false')

  // Escape closes without changing the choice.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  assert.match(await trigger.innerText(), /Compact/)

  // A disabled option stays in the list and cannot be focused or chosen.
  await page.keyboard.press('ArrowDown')
  const loose = list.getByRole('option', { name: 'Loose (unavailable)' })
  assert.equal(await loose.getAttribute('aria-disabled'), 'true')
  await page.keyboard.press('Home')
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown')
  assert.notEqual(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Loose (unavailable)')
  await page.keyboard.press('Enter')

  // Tab closes the list and leaves the focus in the page, not on the removed option.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY')

  // A pointer outside closes the list.
  await page.keyboard.press('ArrowDown')
  await page.locator('h1').click()
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

  assert.deepEqual(errors, [])
  console.log('PASS select menu')
} finally {
  await browser.close()
}
