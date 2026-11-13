// Run against a local devrun server with IDS_URL and optional IDS_SLOT_HINT_SHOTS.
// The inline editor offers the components an operator slot most often takes.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.waitFor({ timeout: 30000 })
    /** The visible title the group is labelled by. @param {import('playwright-core').Locator} group */
    const groupTitle = async group => {
      const id = await group.getAttribute('aria-labelledby')
      assert.ok(id, 'the hint group is labelled')
      return page.locator(`[id="${id}"]`).innerText()
    }

    await field.fill('⿰木⬚')
    await field.press('Tab')
    await page.locator('.ids-tree .ids-part.empty').first().dblclick()
    const panel = page.locator('.slot-hints')
    await panel.waitFor({ timeout: 5000 })
    assert.match(await groupTitle(panel), /part 2 of Left to right/, 'the panel names the slot')
    /** Frame the tree and the panel for a pull-request screenshot. @param {string} name */
    const shot = async name => {
      const dir = process.env.IDS_SLOT_HINT_SHOTS
      if (!dir) return
      const tree = await page.locator('.ids-tree').boundingBox()
      const box = await panel.boundingBox()
      if (!tree || !box) return
      const margin = 40
      const x = Math.max(0, Math.min(tree.x, box.x) - margin)
      const y = Math.max(0, Math.min(tree.y, box.y) - margin)
      const right = Math.min(1440, Math.max(tree.x + tree.width, box.x + box.width) + margin)
      const bottom = Math.min(900, Math.max(tree.y + tree.height, box.y + box.height) + margin)
      await page.mouse.move(8, 8)
      await page.waitForTimeout(100)
      await page.screenshot({ path: `${dir}/${name}-${scheme}.png`, clip: { x, y, width: right - x, height: bottom - y } })
    }
    const hints = await panel.locator('button.hint').allInnerTexts()
    assert.equal(hints.length, 24, 'the panel offers twenty-four components by default')
    await shot('after-default')
    const beforeBox = await panel.boundingBox()
    await panel.getByRole('button', { name: /Show 24 more/ }).click()
    const expanded = await panel.locator('button.hint').allInnerTexts()
    assert.equal(expanded.length, 48, 'Show more reveals the stored components')
    const afterBox = await panel.boundingBox()
    assert.ok(afterBox && afterBox.height > (beforeBox?.height ?? 0), 'the expanded panel grows')
    await shot('after-expanded')
    await panel.getByRole('button', { name: /Show fewer/ }).click()
    assert.equal(await panel.locator('button.hint').count(), 24, 'Show fewer restores the default')
    const editInput = page.locator('.ids-tree .inline-edit input')
    const inputBox = await editInput.boundingBox()
    const collapsedBox = await panel.boundingBox()
    const attached = (a, b) => Math.abs((a.y + a.height) - (b.y - 6)) < 2 || Math.abs(a.y - (b.y + b.height + 6)) < 2
    assert.ok(inputBox && collapsedBox && attached(collapsedBox, inputBox), 'the collapsed panel stays beside the field')
    assert.ok(hints.includes('刂') && hints.includes('頁') && hints.includes('鳥'), 'the right slot offers 刂, 頁 and 鳥')
    assert.match(await panel.locator('button').first().getAttribute('title') ?? '', /Used in this slot by [\d,]+ characters/, 'the count is in the tooltip')
    const box = await panel.boundingBox()
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= 900, 'the panel stays inside the window')

    await panel.getByRole('button', { name: /^刂 / }).click()
    await page.waitForTimeout(300)
    assert.equal(await field.inputValue(), '⿰木刂', 'a click puts the hint in the slot')
    assert.equal(await panel.count(), 0, 'the panel closes after a pick')

    await field.fill('⿰⬚木')
    await field.press('Tab')
    await page.locator('.ids-tree .ids-part.empty').first().dblclick()
    assert.match(await groupTitle(page.locator('.slot-hints')), /part 1 of Left to right/, 'the left slot has its own hints')
    const left = await page.locator('.slot-hints button').allInnerTexts()
    assert.ok(left.includes('木') && left.includes('忄') && left.includes('土'), 'the left slot offers 木, 忄 and 土')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await field.fill('⿱⬚木')
    await field.press('Tab')
    await page.locator('.ids-tree .ids-part.empty').first().dblclick()
    await page.locator('.slot-hints').waitFor({ timeout: 5000 })
    assert.match(await groupTitle(page.locator('.slot-hints')), /part 1 of Above to below/, 'the top slot has its own hints')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '艹', 'Tab reaches the first hint')
    const secondHint = await page.locator('.slot-hints .hint').nth(1).innerText()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), secondHint, 'the arrow keys move through the grid')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    assert.equal(await field.inputValue(), '⿱艹木', 'a keyboard pick puts the hint in the slot')

    await field.fill('⿱木⬚')
    await field.press('Tab')
    await page.getByRole('tab', { name: 'Tree', exact: true }).click()
    await page.waitForTimeout(300)
    const row = page.locator('.ids-treelist [role="treeitem"]').nth(2)
    await row.dblclick()
    await page.locator('.slot-hints').waitFor({ timeout: 5000 })
    assert.match(await groupTitle(page.locator('.slot-hints')), /part 2 of Above to below/, 'the list view offers hints too')
    const bottom = await page.locator('.slot-hints button').allInnerTexts()
    assert.ok(bottom.includes('心') && bottom.includes('灬'), 'the bottom slot offers 心 and 灬')
    await page.locator('.slot-hints button').filter({ hasText: '心' }).click()
    await page.waitForTimeout(300)
    assert.equal(await field.inputValue(), '⿱木心', 'the list view puts the hint in the slot')
    assert.deepEqual(errors, [], 'no page errors')
    await page.close()
  }

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true })
  try {
    const errors = []
    phone.on('pageerror', error => errors.push(error.message))
    await phone.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = phone.locator('.ids-field input')
    await field.waitFor({ timeout: 30000 })
    await field.fill('⿰木⬚')
    await field.press('Tab')
    await phone.getByRole('tab', { name: 'Compose', exact: true }).click()
    await phone.locator('.ids-tree .ids-part.empty').first().dblclick()
    const panel = phone.locator('.slot-hints')
    await panel.waitFor({ timeout: 5000 })
    assert.equal(await panel.locator('button.hint').count(), 24, 'the phone shows twenty-four hints')
    await panel.getByRole('button', { name: /Show 24 more/ }).tap()
    assert.equal(await panel.locator('button.hint').count(), 48, 'the phone can reveal the rest')
    if (process.env.IDS_SLOT_HINT_SHOTS) { await phone.waitForTimeout(350); await phone.screenshot({ path: `${process.env.IDS_SLOT_HINT_SHOTS}/phone-expanded.png` }) }
    const box = await panel.boundingBox()
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, 'the tall panel stays inside the phone window')
    await panel.getByRole('button', { name: /Show fewer/ }).tap()
    const phoneInput = await phone.locator('.ids-tree .inline-edit input').boundingBox()
    const phonePanel = await panel.boundingBox()
    const near = (a, b) => Math.abs((a.y + a.height) - (b.y - 6)) < 2 || Math.abs(a.y - (b.y + b.height + 6)) < 2
    assert.ok(phoneInput && phonePanel && near(phonePanel, phoneInput), 'the collapsed phone panel stays beside the field')
    await panel.getByRole('button', { name: /^刂 / }).tap()
    assert.equal(await field.inputValue(), '⿰木刂', 'a phone tap puts the hint in the slot')

    assert.deepEqual(errors, [], 'no page errors on the phone')
  } finally { await phone.close() }

  const sparse = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true })
  try {
    await sparse.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = sparse.locator('.ids-field input')
    await field.waitFor({ timeout: 30000 })
    await field.fill('⿾⬚')
    await field.press('Tab')
    await sparse.getByRole('tab', { name: 'Compose', exact: true }).click()
    await sparse.locator('.ids-tree .ids-part.empty').first().dblclick()
    const panel = sparse.locator('.slot-hints')
    await panel.waitFor({ timeout: 5000 })
    assert.equal(await panel.locator('button.hint').count(), 15, 'a sparse slot shows all its entries')
    assert.equal(await panel.locator('button.hints-more').count(), 0, 'a sparse slot has no Show more button')
  } finally { await sparse.close() }

  const short = await browser.newPage({ viewport: { width: 390, height: 380 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true })
  try {
    await short.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = short.locator('.ids-field input')
    await field.waitFor({ timeout: 30000 })
    await field.fill('⿰木⬚')
    await field.press('Tab')
    await short.getByRole('tab', { name: 'Compose', exact: true }).click()
    await short.locator('.ids-tree .ids-part.empty').first().dblclick()
    const panel = short.locator('.slot-hints')
    await panel.waitFor({ timeout: 5000 })
    await panel.getByRole('button', { name: /Show 24 more/ }).tap()
    const box = await panel.boundingBox()
    assert.ok(box && box.y >= 0 && box.y + box.height <= 380, 'the expanded panel fits a short window')
  } finally { await short.close() }
  console.log('slot hints: ok')
} finally { await browser.close() }
