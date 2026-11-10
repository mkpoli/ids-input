// An operator button pressed on a draft the tree cannot read yet (口匕, two components and no
// operator) keeps the text and puts the operator in front of it, whether the caret sits before it or
// a selection covers it, and Undo gives the draft back. Run against a served demo:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-invalid-draft.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  const value = () => field.inputValue()
  const leftRight = page.locator('.ids-operators button[data-op="⿰"]')
  const select = async (start, end) => {
    await field.focus()
    await field.evaluate((field, [start, end]) => { field.setSelectionRange(start, end); field.dispatchEvent(new Event('select')) }, [start, end])
  }
  const type = async text => {
    await field.fill(text)
    await page.waitForFunction(want => document.querySelector('.ids-field input')?.value === want, text)
  }

  // Two components and no operator: the field says so, and keeps saying it.
  await type('口匕')
  assert.equal(await field.getAttribute('aria-invalid'), 'true', 'the draft is marked invalid')

  // A. A zero-width selection before the text, then the operator button.
  await select(0, 0)
  await leftRight.click()
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰口匕')
  assert.equal(await value(), '⿰口匕', 'the operator goes in front of the text at the caret')
  assert.equal(await field.getAttribute('aria-invalid'), 'false')

  // Undo goes back to the draft as typed, not to the empty tree the editor last read.
  await page.keyboard.press('Control+z')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '口匕')
  assert.equal(await value(), '口匕', 'Undo gives the unreadable draft back')
  assert.equal(await field.getAttribute('aria-invalid'), 'true')
  await page.keyboard.press('Control+Shift+z')
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰口匕')
  assert.equal(await value(), '⿰口匕', 'Redo puts the operator back')

  // B. A selection over the text, then the operator button.
  await type('口匕')
  await select(0, 2)
  await leftRight.click()
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰口匕')
  assert.equal(await value(), '⿰口匕', 'the operator keeps a selected run of parts')
  assert.equal(await field.getAttribute('aria-invalid'), 'false')

  // A draft the operator cannot make whole stays as typed.
  await type('口 匕')
  await select(0, 0)
  await leftRight.click()
  await page.waitForTimeout(300)
  assert.equal(await value(), '口 匕', 'an unreadable draft is left alone when the operator cannot fix it')

  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS an operator keeps an unreadable draft, before or over a selection, and Undo restores it')
} finally { await browser.close() }
