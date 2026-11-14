// Selecting text in the sequence field shows what can stand in its place beside the field: a
// component's alternatives under its character card, a description's in a panel under the field.
// The structure pane's list stays closed meanwhile. Run against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-selection-alternatives.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${url}/?ids=${encodeURIComponent('⿰木⿱口口')}`, { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input').first()
    await field.waitFor()
    await page.waitForTimeout(800)
    await field.focus()

    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    const card = page.locator('.ids-character-info:popover-open')
    await card.locator('.extra .ids-swap').first().waitFor({ timeout: 15000 })
    assert.equal((await card.locator('.glyph').textContent())?.trim(), '木', 'the card describes the selected component')
    assert.equal(await page.locator('.ids-swaps').count(), 0, 'the structure pane keeps its list closed')

    await page.keyboard.press('End')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft')
    const panel = page.locator('.ids-selection-panel')
    const merge = panel.getByRole('button', { name: /吕/ })
    await merge.waitFor({ timeout: 15000 })
    assert.equal(await card.count(), 0, 'selecting a description closes the card')
    assert.equal(await page.locator('.ids-swaps').count(), 0, 'the structure pane keeps its list closed')

    await page.keyboard.press('Escape')
    await panel.waitFor({ state: 'detached' })
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft')
    await merge.click()
    await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰木吕')

    // A drag over the description leaves the pointer on one of its parts, whose card stays shut.
    await page.goto(`${url}/?ids=${encodeURIComponent('⿰木⿱口口')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await page.waitForTimeout(800)
    const spans = page.locator('.sequence-paint span')
    const from = await spans.nth(2).boundingBox(), to = await spans.nth(4).boundingBox()
    assert.ok(from && to, 'the painted parts have boxes')
    await page.mouse.move(from.x + 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width - 2, to.y + to.height / 2, { steps: 8 })
    await page.mouse.up()
    await merge.waitFor({ timeout: 15000 })
    await page.waitForTimeout(800)
    assert.equal(await card.count(), 0, 'no hover card over a selected description')

    // A part put in from the tools after a field selection gets the structure pane's list again.
    await field.focus()
    await page.keyboard.press('Home')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await card.waitFor({ timeout: 15000 })
    await page.locator('.ids-slot').fill('木')
    await page.locator('.ids-slot').press('Enter')
    await page.locator('.ids-swaps').waitFor({ timeout: 15000 })

    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: selected text lists its alternatives beside the field`)
    await page.close()
  }
} finally {
  await browser.close()
}
