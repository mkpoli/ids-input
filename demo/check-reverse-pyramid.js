// Run against a local preview with IDS_URL; set IDS_PYRAMID_SHOTS to save screenshots.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
import { pyramidRows, parse } from '../src/core/index.js'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://127.0.0.1:5197/?lang=en')
    const field = page.locator('.ids-field input')
    await field.fill('')
    await field.press('Tab')
    await page.getByRole('tab', { name: 'Templates', exact: true }).click()
    const toggle = page.getByRole('checkbox', { name: 'Reverse', exact: true })
    assert.equal(await toggle.isChecked(), false)
    const normalIcon = await page.locator('[data-pyramid="3"] svg').innerHTML()
    await toggle.focus()
    await page.keyboard.press('Space')
    assert.equal(await toggle.isChecked(), true)
    assert.equal(await field.inputValue(), '', 'changing direction does not edit the document')
    assert.notEqual(await page.locator('[data-pyramid="3"] svg').innerHTML(), normalIcon)
    assert.match(await page.locator('[data-pyramid="3"]').getAttribute('aria-label'), /inverted pyramid/)
    assert.match(await page.locator('[data-pyramid="3"]').getAttribute('title'), /inverted pyramid/)
    await page.getByRole('tab', { name: 'Parts', exact: true }).click()
    await page.getByRole('tab', { name: 'Templates', exact: true }).click()
    assert.equal(await toggle.isChecked(), true, 'direction survives tab switches')
    await page.locator('[data-pyramid="3"]').click()
    assert.deepEqual(pyramidRows(parse(await field.inputValue()).tree), { cell: '口', layers: 3, count: 6, reverse: true })
    await page.locator('.ids-preview[data-step="composed"]').waitFor()
    if (process.env.IDS_PYRAMID_SHOTS) {
      mkdirSync(process.env.IDS_PYRAMID_SHOTS, { recursive: true })
      await page.locator('.ids-pyramid').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${process.env.IDS_PYRAMID_SHOTS}/after-${colorScheme}.png` })
    }
    await field.fill('')
    await field.press('Tab')
    await page.locator('form[id$="-pyramid-form"] input[type=number]').fill('24')
    await page.locator('form[id$="-pyramid-form"] button').click()
    assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.layers, 24)
    assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.reverse, true)
    await field.fill('')
    await field.press('Tab')
    await toggle.uncheck()
    await page.locator('[data-pyramid="5"]').click()
    assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.reverse, false)
    assert.deepEqual(errors, [])
    console.log(`PASS ${colorScheme}: keyboard toggle, direction-aware icons, preset/custom insertion, reset direction`)
    await page.close()
  }
} finally { await browser.close() }
