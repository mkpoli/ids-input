// Draw in the Find tab's pad and pick a result. Run against a local server with IDS_URL and
// CHROMIUM_PATH, like the other demo checks.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5186'}?lang=en`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-field input').waitFor()

  await page.getByRole('tab', { name: 'Find' }).click()
  await page.locator('.ids-draw-toggle').click()
  await page.locator('canvas.pad').waitFor()
  await page.waitForFunction(() => !document.querySelector('.ids-sketch .bar'), null, { timeout: 30000 })

  // Choose the tree's first part, so the picked result replaces something.
  const part = page.locator('.ids-part').first()
  await part.click()
  if (await part.getAttribute('aria-pressed') !== 'true') await part.click()
  const before = await page.locator('.ids-field input').inputValue()

  const box = await page.locator('canvas.pad').boundingBox()
  const at = ([x, y]) => [box.x + x / 100 * box.width, box.y + y / 100 * box.height]
  const strokes = [
    [[32, 10], [32, 90]], [[32, 10], [68, 10], [68, 90]], [[32, 50], [68, 50]], [[32, 90], [68, 90]],
  ]
  for (const line of strokes) {
    await page.mouse.move(...at(line[0]))
    await page.mouse.down()
    for (const point of line.slice(1)) await page.mouse.move(...at(point), { steps: 8 })
    await page.mouse.up()
  }

  await page.locator('.ids-sketch .hit').first().waitFor({ timeout: 10000 })
  const hits = await page.locator('.ids-sketch .hit').allTextContents()
  assert.ok(hits.length >= 10, `enough matches: ${hits.length}`)
  assert.ok(hits.includes('日'), `日 among the matches: ${hits.slice(0, 12).join(' ')}`)

  await page.locator('.ids-sketch .hit').filter({ hasText: '日' }).first().click()
  const after = await page.locator('.ids-field input').inputValue()
  assert.notEqual(after, before, 'picking a match changes the sequence')
  assert.ok(after.includes('日'), `the sequence holds 日: ${after}`)

  await page.locator('.ids-sketch').getByRole('button', { name: 'Type instead' }).click()
  const field = page.locator('.ids-find input')
  await field.fill('水')
  await page.locator('.ids-find .ids-hit').first().waitFor({ timeout: 10000 })
  assert.ok((await page.locator('.ids-find .ids-hit').allTextContents()).some(text => text.includes('水')), 'typed search still finds 水')

  assert.deepEqual(errors, [])
  console.log('PASS sketch pad')
} finally {
  await browser.close()
}
