// Run against a local devrun server with IDS_URL and optional IDS_OPERATOR_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill('⿰木口')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('img').waitFor({ timeout: 30000 })
    await dialog.getByRole('treeitem').nth(0).click()
    assert.equal(await dialog.getByRole('treeitem').nth(0).getAttribute('aria-selected'), 'true')
    await dialog.getByRole('button', { name: 'Edit on canvas', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const handle = page.locator('.ids-preview .handle.move')
    await handle.waitFor({ timeout: 10000 })
    const grip = await handle.boundingBox()
    assert.ok(grip, 'the operator has a move handle')
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x + grip.width / 2 + 40, grip.y + grip.height / 2 + 20)
    await page.mouse.up()
    await page.waitForTimeout(500)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document)
    const operator = stored?.root?.transform?.[0]?.matrix
    assert.ok(Math.abs(operator?.[4] ?? 0) > 1 || Math.abs(operator?.[5] ?? 0) > 1, 'the operator transform moved the subtree')
    assert.equal(stored?.root?.children?.[0]?.transform, undefined, 'the component kept its own transform')
    if (process.env.IDS_OPERATOR_SHOTS) {
      mkdirSync(process.env.IDS_OPERATOR_SHOTS, { recursive: true })
      await page.locator('.ids-preview').screenshot({ path: `${process.env.IDS_OPERATOR_SHOTS}/operator-${scheme}.png` })
    }
    await page.getByRole('button', { name: 'Reset part', exact: true }).click()
    await page.waitForTimeout(300)
    const reset = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.transform)
    assert.equal(reset, undefined)
    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: operator selected and dragged as one layer`)
    await page.close()
  }
} finally {
  await browser.close()
}
