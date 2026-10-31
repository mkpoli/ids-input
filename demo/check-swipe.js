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
  assert.deepEqual(errors, [])
  console.log('PASS horizontal swipes move Input → Compose and back; field swipes are ignored')
} finally { await browser.close() }
