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
    const hints = await panel.locator('button').allInnerTexts()
    assert.equal(hints.length, 12, 'the panel offers twelve components')
    assert.ok(hints.includes('刂') && hints.includes('頁') && hints.includes('鳥'), 'the right slot offers 刂, 頁 and 鳥')
    assert.match(await panel.locator('button').first().getAttribute('title') ?? '', /Used in this slot by [\d,]+ characters/, 'the count is in the tooltip')
    const box = await panel.boundingBox()
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= 900, 'the panel stays inside the window')
    if (process.env.IDS_SLOT_HINT_SHOTS) await page.screenshot({ path: `${process.env.IDS_SLOT_HINT_SHOTS}/slot-hints-${scheme}.png` })

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
  console.log('slot hints: ok')
} finally { await browser.close() }
