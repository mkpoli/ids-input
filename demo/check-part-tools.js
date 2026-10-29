// The chosen part's tools: Clear part carries the ⬚ icon, the operator palette's ⬚ empties the chosen
// part with ?, and Remove this level says what it keeps. Run against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-part-tools.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${url}/#${encodeURIComponent('⿰亻⿱七木')}`, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.waitFor()
  const value = () => field.inputValue()
  /** Choose the nth part of the tree; a click on a chosen part lets it go, so it is clicked again then. */
  const choose = async n => {
    const part = page.locator('.ids-part').nth(n)
    await part.click()
    if (await part.getAttribute('aria-pressed') !== 'true') await part.click()
    await field.focus() // Let the part's character card close without Escape, which lets the part go.
  }

  const groups = await page.locator('.ids-op-group').evaluateAll(els => els.map(el => [el.querySelector('.ids-op-label').textContent, el.querySelectorAll('.ids-key').length]))
  assert.deepEqual(groups, [['1 part', 3], ['3 parts', 2], ['Empty slot', 1], ['2 parts', 13]], 'the palette names the empty slot after the operator groups')
  assert.equal(await page.locator('.ids-key-empty .ids-kbd').textContent(), '?', 'the empty slot shows its key')
  assert.equal(await page.locator('.ids-part-tools .ids-empty').count(), 0, 'the tools keep one ⬚ button')
  assert.equal(await page.locator('.ids-clear .ids-glyph').textContent(), '⬚', 'Clear part carries the ⬚ icon')
  assert.ok((await page.locator('.ids-clear').innerText()).includes('Clear part'), 'Clear part keeps its name')
  assert.equal(await page.locator('.ids-key-empty').isDisabled(), true, 'the empty slot waits for a chosen part')

  await choose(0)
  assert.equal(await page.locator('.ids-key-empty').isDisabled(), false, 'a chosen part enables the empty slot')
  await page.locator('.ids-key-empty').click()
  assert.equal(await value(), '⿰⬚⿱七木', 'the palette empties the chosen part')
  await page.locator('.toast button').click()
  assert.equal(await value(), '⿰亻⿱七木', 'the palette change can be undone')

  await choose(0)
  await page.locator('.ids-clear').click()
  assert.equal(await value(), '⿰⬚⿱七木', 'the merged button empties the chosen part')
  await page.locator('.toast button').click()
  const slot = page.locator('input.ids-slot')
  await slot.fill('亻')
  await slot.press('Enter')
  await page.locator('.ids-part').first().focus()
  await page.keyboard.press('?')
  assert.equal(await value(), '⿰⬚⿱七木', '? empties the chosen part')

  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS Clear part carries ⬚ and the palette adds a ? empty slot')
} finally { await browser.close() }
