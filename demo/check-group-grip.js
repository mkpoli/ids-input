// The grip at the head of a group: it marks the handle of a frame whose parts fill the rest, and it
// drags the group as one element. Run against a dev server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-group-grip.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const field = page.locator('.ids-field input')
  const open = async sequence => {
    await page.goto(`${url}/?ids=${encodeURIComponent(sequence)}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await page.waitForTimeout(600)
  }

  await open('⿱⿰木口⿱日火')
  const grips = page.locator('.ids-tree .ids-grip')
  assert.equal(await grips.count(), 2, 'every group below the root has a grip, the root none')
  assert.equal(await grips.first().getAttribute('draggable'), 'true', 'the grip starts a drag')
  assert.match(await grips.first().getAttribute('aria-label'), /Left to right/, 'the grip names the group it moves')
  assert.equal(await page.locator('.chosen').count(), 0, 'nothing is chosen on arrival')
  await grips.first().click()
  assert.equal(await page.locator('.chosen').count(), 0, 'a click on the grip moves nothing and chooses nothing')

  const source = await grips.first().boundingBox()
  const target = await page.locator('.ids-tree .ids-part').nth(3).boundingBox()
  assert.ok(source && target, 'both boxes are on screen')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2 + 10, { steps: 4 })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(400)
  assert.equal(await field.inputValue(), '⿱火⿱日⿰木口', 'a group dragged by its grip switches places as one element')

  assert.deepEqual(errors, [])
  console.log('PASS the group grip shows the handle and drags the whole group')
} finally { await browser.close() }
