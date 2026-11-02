// Lifting a box with the space bar: the keyboard way to switch a part with one in another branch.
// Space lifts the focused box, the arrows or Tab move the focus, Space again places it, Escape
// lets it go. Run against a dev server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-keyboard-swap.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const field = page.locator('.ids-field input')
  const value = () => field.inputValue()
  const open = async sequence => {
    await page.goto(`${url}/?ids=${encodeURIComponent(sequence)}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await page.waitForTimeout(500)
  }
  const escape = async () => { await page.keyboard.down('Escape'); await page.keyboard.up('Escape'); await page.waitForTimeout(150) }
  const part = index => page.locator('.ids-tree .ids-part').nth(index)

  await open('⿱⿰木口日')
  await part(0).focus()
  await page.keyboard.press(' ')
  assert.equal(await page.locator('.ids-part.carried').count(), 1, 'Space lifts the focused part')
  assert.equal(await page.locator('.ids-part.carried').textContent(), '木', 'the lifted box is marked')
  await part(2).focus()
  await page.keyboard.press(' ')
  assert.equal(await value(), '⿱⿰日口木', 'Space on another part places the lifted one there')
  assert.equal(await page.locator('.ids-part.carried').count(), 0, 'the lift ends on placing')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  assert.equal(await value(), '⿱⿰木口日', 'one undo puts the parts back')

  await part(0).focus()
  await page.keyboard.press(' ')
  await escape()
  assert.equal(await page.locator('.ids-part.carried').count(), 0, 'Escape lets the lifted box go')
  await part(2).focus()
  await page.keyboard.press(' ')
  assert.equal(await value(), '⿱⿰木口日', 'after Escape, Space lifts the box under the focus instead of placing')

  await open('⿱⿰木口日')
  await part(1).focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.ids-part[aria-pressed="true"]').textContent(), '口', 'Enter still chooses the box')

  await open('⿲木口日')
  await part(0).focus()
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt')
  await page.waitForTimeout(250)
  assert.equal(await value(), '⿲口木日', 'Alt+arrow still moves a part along its row')

  // A group is lifted by its operator button and placed the same way.
  await open('⿱⿰木口⿱日火')
  await page.locator('.ids-tree .ids-op').nth(1).focus()
  await page.keyboard.press(' ')
  assert.equal(await page.locator('.ids-node.carried').count(), 1, 'Space lifts a whole group from its operator button')
  await part(3).focus()
  await page.keyboard.press(' ')
  assert.equal(await value(), '⿱火⿱日⿰木口', 'the lifted group takes the place of the box under the focus')

  // The list view works the same way, with the arrows moving the focus between rows.
  await open('⿱⿰木口日')
  await page.getByRole('tab', { name: 'Tree' }).click()
  const row = path => page.locator(`.ids-treelist [data-path="${path}"]`)
  await row('0.0').focus()
  await page.keyboard.press(' ')
  assert.equal(await page.locator('li.carried').count(), 1, 'Space lifts the focused row')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-path')), '1', 'the arrows move between rows')
  await page.keyboard.press(' ')
  assert.equal(await value(), '⿱⿰日口木', 'Space places the lifted row on the focused row')

  assert.deepEqual(errors, [])
  console.log('PASS Space lifts and places a box in both views, and Escape lets it go')
} finally { await browser.close() }
