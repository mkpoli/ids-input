// Run against a local preview with IDS_URL; set IDS_PYRAMID_SHOTS to save screenshots.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
import { pyramidRows, pyramidSequence, parse } from '../src/core/index.js'

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
    const buttons = {
      top: page.locator('[data-direction="top"]'), bottom: page.locator('[data-direction="bottom"]'),
      left: page.locator('[data-direction="left"]'), right: page.locator('[data-direction="right"]'),
    }
    const names = { top: 'Up', bottom: 'Down', left: 'Left', right: 'Right' }
    for (const [direction, button] of Object.entries(buttons)) {
      assert.equal(await button.getAttribute('aria-label'), names[direction])
      assert.equal(await button.getAttribute('aria-pressed'), direction === 'top' ? 'true' : 'false')
    }
    assert.equal(await field.inputValue(), '')
    await buttons.bottom.click()
    assert.equal(await field.inputValue(), '', 'changing direction does not edit the document')
    assert.equal(await buttons.bottom.getAttribute('aria-pressed'), 'true')
    assert.equal(await buttons.top.getAttribute('aria-pressed'), 'false')
    // Every direction draws its own preset icons and names its own insertion.
    const icons = new Set()
    for (const [direction, button] of Object.entries(buttons)) {
      await button.click()
      icons.add(await page.locator('[data-pyramid="3"] svg').innerHTML())
      const label = await page.locator('[data-pyramid="3"]').getAttribute('aria-label')
      if (direction === 'top') assert.match(label, /3-layer pyramid of 口$/)
      if (direction === 'bottom') assert.match(label, /inverted pyramid/)
      if (direction === 'left') assert.match(label, /pointing left/)
      if (direction === 'right') assert.match(label, /pointing right/)
    }
    assert.equal(icons.size, 4, 'each direction draws its own preset icons')
    await buttons.bottom.click()
    await page.getByRole('tab', { name: 'Parts', exact: true }).click()
    await page.getByRole('tab', { name: 'Templates', exact: true }).click()
    assert.equal(await buttons.bottom.getAttribute('aria-pressed'), 'true', 'direction survives tab switches')
    await page.locator('[data-pyramid="3"]').click()
    assert.deepEqual(pyramidRows(parse(await field.inputValue()).tree), { cell: '口', layers: 3, count: 6, direction: 'bottom' })
    await page.locator('.ids-preview[data-step="composed"]').waitFor()
    for (const direction of ['left', 'right']) {
      await field.fill('')
      await field.press('Tab')
      await buttons[direction].click()
      await page.locator('[data-pyramid="3"]').click()
      assert.equal(await field.inputValue(), pyramidSequence('口', 3, { direction }))
      assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.direction, direction)
    }
    await field.fill('')
    await field.press('Tab')
    await buttons.bottom.click()
    await page.locator('form[id$="-pyramid-form"] input[type=number]').fill('24')
    await page.locator('form[id$="-pyramid-form"] button').click()
    assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.layers, 24)
    assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.direction, 'bottom')
    await field.fill('')
    await field.press('Tab')
    await buttons.top.click()
    await page.locator('[data-pyramid="5"]').click()
    assert.equal(pyramidRows(parse(await field.inputValue()).tree)?.direction, 'top')
    if (process.env.IDS_PYRAMID_SHOTS) {
      mkdirSync(process.env.IDS_PYRAMID_SHOTS, { recursive: true })
      await page.locator('.ids-pyramid').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${process.env.IDS_PYRAMID_SHOTS}/after-${colorScheme}.png` })
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${colorScheme}: four-way switch, direction-aware icons and labels, preset/custom insertion, reset`)
    await page.close()
  }
} finally { await browser.close() }
