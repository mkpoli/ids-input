// Run against a local devrun server with IDS_URL and optional IDS_LAYER_SHOTS.
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
    const items = dialog.getByRole('treeitem')
    assert.equal(await items.count(), 3)
    await items.nth(1).click()
    await dialog.getByRole('button', { name: 'Matrix', exact: true }).click()
    const matrixFields = dialog.locator('input[type=number]')
    await matrixFields.nth(1).fill('0.2')
    await matrixFields.nth(1).press('Tab')
    await page.waitForTimeout(500)
    const matrixStored = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document)
    assert.deepEqual(matrixStored?.root?.children?.[0]?.transform?.[0]?.matrix, [1, 0.2, 0, 1, 0, 0])
    await page.evaluate(() => { const element = document.querySelector('dialog .body'); if (element) element.scrollTop = 0 })
    if (process.env.IDS_LAYER_SHOTS) await dialog.locator('fieldset.transform').screenshot({ path: `${process.env.IDS_LAYER_SHOTS}/matrix-${scheme}.png` })
    await dialog.getByRole('button', { name: 'Reset transform', exact: true }).click()

    await dialog.getByRole('button', { name: 'Möbius', exact: true }).click()
    const fields = dialog.locator('input[type=number]')
    await fields.nth(4).fill('0.001')
    await fields.nth(4).press('Tab')
    await page.waitForTimeout(600)
    const mobius = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document)
    assert.equal(mobius?.root?.children?.[0]?.transform?.[0]?.type, 'mobius')
    assert.deepEqual(mobius?.root?.children?.[0]?.transform?.[0]?.c, [0.001, 0])
    assert.ok((await dialog.locator('img').getAttribute('src'))?.length > 100, 'the Möbius drawing exists')
    if (process.env.IDS_LAYER_SHOTS) await dialog.screenshot({ path: `${process.env.IDS_LAYER_SHOTS}/mobius-${scheme}.png` })

    await dialog.getByRole('button', { name: 'Reset transform', exact: true }).click()
    await dialog.getByRole('treeitem').nth(1).dblclick()
    const splits = dialog.locator('.splits button')
    await splits.first().waitFor({ timeout: 10000 })
    if (process.env.IDS_LAYER_SHOTS) await dialog.screenshot({ path: `${process.env.IDS_LAYER_SHOTS}/split-${scheme}.png` })
    await splits.first().click()
    await page.waitForTimeout(1000)
    const sequence = await page.locator('.ids-field input').inputValue()
    assert.notEqual(sequence, '⿰木口', 'the editor tree follows the decomposition')
    const decomposed = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document)
    assert.equal(decomposed?.root?.children?.[0]?.kind, 'operator')
    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: layers, selection, affine and Möbius transform records`)
    await page.close()
  }
} finally { await browser.close() }
