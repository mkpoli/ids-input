// An operator still missing operands draws them as ⬚ slots after the text, and their scope lines in
// the warning colour: ⿳ has three missing, ⿳⬚ two, ⿳⬚⬚ one, and ⿳木火 one. The text itself holds only
// what was typed, so ⬚ is drawn rather than written. Run against a served demo:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-missing-slots.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  const value = () => field.inputValue()
  const painted = () => page.locator('.sequence-run span').allTextContents()
  const missing = () => page.locator('.sequence-scopes .scope-missing').count()
  const clear = async () => {
    await field.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(200)
    assert.equal(await value(), '')
  }
  const type = async text => {
    for (const char of text) await page.keyboard.insertText(char)
    await page.waitForTimeout(300)
  }

  // Three operands missing: the field draws three slots, none of them written.
  await clear()
  await type('⿳')
  assert.equal(await value(), '⿳', 'the text stops at the operator')
  assert.deepEqual(await painted(), ['⿳', '⬚', '⬚', '⬚'], 'the field draws the three slots')
  assert.equal(await missing(), 3, 'all three scopes are warning-coloured')

  // One slot written, two missing.
  await type('⬚')
  assert.equal(await value(), '⿳⬚', 'a written slot stays in the text')
  assert.deepEqual(await painted(), ['⿳', '⬚', '⬚', '⬚'])
  assert.equal(await missing(), 2)

  // Two written, one missing.
  await type('⬚')
  assert.equal(await value(), '⿳⬚⬚')
  assert.equal(await missing(), 1)
  await type('木')
  assert.equal(await value(), '⿳⬚⬚木')
  assert.equal(await missing(), 0, 'no operand is missing any more')

  // The operator button leaves the same three slots.
  await clear()
  await page.locator('.ids-operators button[data-op="⿳"]').click()
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿳')
  assert.deepEqual(await painted(), ['⿳', '⬚', '⬚', '⬚'])
  assert.equal(await missing(), 3)

  // A filled operand, and the missing ones after it.
  await clear()
  await type('⿳木')
  assert.equal(await value(), '⿳木')
  assert.deepEqual(await painted(), ['⿳', '木', '⬚', '⬚'])
  assert.equal(await missing(), 2)

  // Leaving the field keeps the text as typed rather than writing the slots out.
  await type('火')
  await field.blur()
  await page.waitForTimeout(300)
  assert.equal(await value(), '⿳木火')
  assert.equal(await missing(), 1)
  assert.deepEqual(await painted(), ['⿳', '木', '火', '⬚'])

  // The missing scopes take the warning colour, not the muted scope colour.
  const strokes = await page.evaluate(() => ({
    missing: getComputedStyle(document.querySelector('.scope-missing')).stroke,
    plain: getComputedStyle(document.querySelector('.scope-segment:not(.scope-missing)')).stroke,
  }))
  assert.equal(strokes.missing, 'rgb(180, 35, 24)', 'a missing scope draws in the warning colour')
  assert.notEqual(strokes.missing, strokes.plain, 'a missing scope differs from a drawn one')

  // A long draft scrolls far enough to show the slots drawn after it.
  await clear()
  await type('⿰' + '木'.repeat(40) + '⿱')
  await field.evaluate(field => { field.focus(); field.setSelectionRange(field.value.length, field.value.length); field.scrollLeft = field.scrollWidth })
  await page.waitForTimeout(400)
  const visible = await page.evaluate(() => {
    const paint = document.querySelector('.sequence-paint').getBoundingClientRect()
    const slots = [...document.querySelectorAll('.sequence-run span.missing')]
    return slots.length === 2 && slots.every(span => span.getBoundingClientRect().right <= paint.right + 1)
  })
  assert.ok(visible, 'the drawn slots come into view at the end of a long draft')

  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS missing operands draw as ⬚ after the typed text, their scopes in the warning colour')
} finally { await browser.close() }
