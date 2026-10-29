// Run with IDS_URL and CHROMIUM_PATH; optionally set IDS_PYRAMID_SHOTS.
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
    const group = page.locator('.ids-pyramid')
    const capture = async prefix => {
      if (!process.env.IDS_PYRAMID_SHOTS) return
      mkdirSync(process.env.IDS_PYRAMID_SHOTS, { recursive: true })
      await group.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${process.env.IDS_PYRAMID_SHOTS}/${prefix}-${colorScheme}.png` })
    }
    if (process.env.IDS_PYRAMID_BASELINE) {
      await capture('before')
      await page.close()
      continue
    }
    const part = group.getByRole('textbox', { name: 'Component', exact: true })
    const rows = group.locator('input[type=number]')
    const insert = group.getByRole('button', { name: 'Insert', exact: true })
    const preset = group.locator('[data-pyramid="3"]')
    assert.equal(await part.inputValue(), '口')
    for (const invalid of ['', '木口', '⿰木口', ' ', '⿱', '木ˊ']) {
      await part.fill(invalid)
      assert.equal(await part.getAttribute('aria-invalid'), 'true')
      assert.equal(await insert.isDisabled(), true)
      for (const button of await group.locator('[data-pyramid]').all()) assert.equal(await button.isDisabled(), true)
      await part.press('Enter')
      assert.equal(await field.inputValue(), '', 'invalid input cannot submit')
    }
    await part.fill('木')
    assert.equal(await part.getAttribute('aria-invalid'), 'false')
    assert.match(await preset.getAttribute('aria-label'), /木/)
    await rows.fill('2')
    await part.press('Enter')
    assert.equal(await field.inputValue(), '', 'invalid row count cannot submit')
    await rows.fill('5')
    await page.getByRole('tab', { name: 'Parts', exact: true }).click()
    await page.getByRole('tab', { name: 'Templates', exact: true }).click()
    assert.equal(await part.inputValue(), '木')
    await preset.click()
    assert.deepEqual(pyramidRows(parse(await field.inputValue()).tree), { part: '木', layers: 3, count: 6, reverse: false })
    assert.equal(await part.inputValue(), '木', 'insertion keeps the typed component')
    await field.fill('')
    await field.press('Tab')
    await group.getByRole('checkbox', { name: 'Reverse', exact: true }).check()
    await rows.fill('5')
    await part.press('Enter')
    assert.deepEqual(pyramidRows(parse(await field.inputValue()).tree), { part: '木', layers: 5, count: 15, reverse: true })
    await page.locator('.ids-preview[data-step="composed"]').waitFor()
    await capture('after')
    for (const component of ['𠮷', '木\uFE00', '가']) {
      await field.fill('')
      await field.press('Tab')
      await part.fill(component)
      assert.equal(await part.getAttribute('aria-invalid'), 'false', component)
      await preset.click()
      assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.part, component)
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${colorScheme}: typed components, validation, presets, custom rows, reverse, Enter, tab persistence, Unicode components`)
    await page.close()
  }
} finally { await browser.close() }
