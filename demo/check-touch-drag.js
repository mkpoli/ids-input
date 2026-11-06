// Touch dragging in the shape tree: a finger drags a part, or a whole group by its frame, onto
// another box exactly as a mouse drag does. Touch fires no dragstart, so this drives real touch
// events through CDP and checks the swap, the ghost, a tap that still chooses, and a drop on empty
// space that changes nothing. Run against a dev server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-touch-drag.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const context = await browser.newContext({ viewport: { width: 900, height: 800 }, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const client = await context.newCDPSession(page)
  const field = page.locator('.ids-field input')
  const value = () => field.inputValue()
  const touch = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const open = async sequence => {
    await page.goto(`${url}/?ids=${encodeURIComponent(sequence)}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await page.waitForTimeout(600)
  }
  /** Where the middle of each match sits, or the top of a box. @param {string} selector @param {'middle'|'top'} [at] */
  const points = (selector, at = 'middle') => page.locator(selector).evaluateAll((elements, at) => elements.map(element => {
    const box = element.getBoundingClientRect()
    return { x: box.x + box.width / 2, y: at === 'top' ? box.y + 9 : box.y + box.height / 2 }
  }), at)
  /** Drag a finger from one point to another, letting the pointer settle on the target before it lifts. */
  const drag = async (from, to) => {
    await touch('touchStart', [{ x: from.x, y: from.y, id: 1 }])
    for (let step = 1; step <= 8; step++) {
      await touch('touchMove', [{ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8, id: 1 }])
    }
    await page.waitForTimeout(150)
    const ghost = await page.locator('.ids-touch-ghost').textContent().catch(() => null)
    await touch('touchEnd', [])
    await page.waitForTimeout(450)
    return ghost
  }

  await open('⿱⿰木口日')
  const parts = await points('.ids-tree .ids-part')
  const ghost = await drag(parts[0], parts[2])
  assert.equal(await value(), '⿱⿰日口木', 'a part dragged by touch switches places with the part it is dropped on')
  assert.equal(ghost, '木', 'the finger carries the dragged part')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  assert.equal(await value(), '⿱⿰木口日', 'one undo puts the parts back')

  const unchanged = await drag(parts[0], { x: 20, y: 760 })
  assert.equal(await value(), '⿱⿰木口日', 'a drop on empty space changes nothing')
  assert.equal(unchanged, '木', 'the ghost still follows the finger')

  await page.touchscreen.tap(parts[1].x, parts[1].y)
  await page.waitForTimeout(250)
  assert.equal(await page.locator('.ids-part[aria-pressed="true"]').textContent(), '口', 'a tap still chooses the box')

  await open('⿱⿰木口⿱日火')
  const groups = await points('.ids-tree .ids-node', 'top')
  const target = (await points('.ids-tree .ids-part'))[3]
  const groupGhost = await drag(groups[1], target)
  assert.equal(await value(), '⿱火⿱日⿰木口', 'a group dragged by its frame switches places as one element')
  assert.equal(groupGhost, '⿰木口', 'the finger carries the whole group')

  assert.deepEqual(errors, [])
  console.log('PASS touch drags parts and groups in the shape tree')
} finally { await browser.close() }
