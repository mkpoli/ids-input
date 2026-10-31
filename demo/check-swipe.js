// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const pointer = (type, x) => ({ pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: 420, bubbles: true, cancelable: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ state: 'attached', timeout: 30000 })

  // A swipe starting on a field is an interaction, not a tab gesture.
  await page.dispatchEvent('.pane.input input', 'pointerdown', pointer('pointerdown', 300))
  await page.dispatchEvent('.pane.input input', 'pointerup', pointer('pointerup', 150))
  await page.waitForTimeout(300)
  assert.equal(await page.locator('.pane.input').isVisible(), true, 'a swipe from a field does not change tabs')

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y: 300 }] })
  for (const x of [280, 240, 200, 160]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 300 }] })
    await page.waitForTimeout(30)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(350)
  assert.equal(await page.locator('.middle').isVisible(), true, 'left swipe moves Input to Compose')
  assert.equal(await page.locator('.pane.input').isVisible(), false)

  await page.dispatchEvent('.middle', 'pointerdown', pointer('pointerdown', 100))
  await page.dispatchEvent('.middle', 'pointerup', pointer('pointerup', 260))
  await page.waitForTimeout(350)
  assert.equal(await page.locator('.pane.input').isVisible(), true, 'right swipe moves Compose back to Input')
  assert.equal(await page.locator('.middle').isVisible(), false)

  await page.locator('.phone-tabs').getByRole('tab', { name: 'Output', exact: true }).click()
  const preview = await page.locator('.ids-preview').boundingBox()
  assert.ok(preview, 'the output has a preview')
  const y = preview.y + Math.min(120, preview.height / 2)
  const from = preview.x + preview.width * 0.3, to = preview.x + preview.width * 0.8
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
  for (const x of [from + 30, from + 60, from + 90, to]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await page.waitForTimeout(30)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(350)
  assert.equal(await page.locator('.middle').isVisible(), true, 'a swipe on the drawing moves Output back to Compose')

  await page.locator('.phone-tabs').getByRole('tab', { name: 'Output', exact: true }).click()
  await page.getByRole('button', { name: 'Adjust layout', exact: true }).click()
  await page.waitForTimeout(300)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
  for (const x of [from + 30, from + 60, from + 90, to]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await page.waitForTimeout(30)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(350)
  assert.equal(await page.locator('.pane.output').isVisible(), true, 'a drawing swipe in Adjust layout stays on Output')
  assert.deepEqual(errors, [])
  console.log('PASS swipes move Input → Compose → drawing → Compose; field swipes are ignored')
} finally { await browser.close() }
