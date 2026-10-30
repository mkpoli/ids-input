// Tabs keep their order when dragged sideways: the dragged tab follows the pointer, the strip
// reorders while it moves, the active tab and its editor stay put, and the order is kept for the
// next visit. Shift with the arrow keys moves the focused tab too. Run against a devrun server:
//   IDS_URL=http://localhost:5196 CHROMIUM_PATH=/path/to/chrome bun demo/check-tab-drag.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })
  const order = () => page.locator('.tabbar .tab').evaluateAll(els => els.map(el => /** @type {HTMLElement} */ (el).dataset.tabId))
  const active = () => page.locator('.tabbar .tab.on').getAttribute('data-tab-id')
  const box = async id => {
    const found = await page.locator(`.tab[data-tab-id="${id}"]`).boundingBox()
    assert.ok(found, `tab ${id} has a box`)
    return found
  }
  // A lone tab cannot be dragged; it would only be clipped out of the strip.
  assert.equal((await order()).length, 1, 'the workshop starts with one tab')
  const lone = await box((await order())[0])
  await page.mouse.move(lone.x + lone.width / 2, lone.y + lone.height / 2)
  await page.mouse.down()
  await page.mouse.move(lone.x + lone.width / 2 + 30, lone.y + lone.height / 2, { steps: 6 })
  assert.equal(await page.locator('.tab.dragging').count(), 0, 'a lone tab stays put')
  await page.mouse.up()
  // Three tabs, the last one active.
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'New tab', exact: true }).click()
  const [first, second, third] = await order()
  assert.equal((await order()).length, 3, 'three tabs are open')
  const chosen = await active()

  // Drag the first tab past the last one: it takes the last place while the pointer is still down,
  // the strip marks it as dragged, and neither the active tab nor its editor follows it.
  const start = await box(first), end = await box(third)
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2)
  const nudged = await box(first)
  assert.ok(Math.abs(nudged.x - start.x - 20) <= 2, 'the held tab follows the pointer')
  await page.mouse.move(end.x + end.width / 2 + 10, end.y + end.height / 2, { steps: 20 })
  assert.deepEqual(await order(), [second, third, first], 'the dragged tab takes the place under the pointer')
  assert.equal(await page.locator('.tab.dragging').count(), 1, 'the dragged tab is marked')
  const moved = await page.locator(`.tab[data-tab-id="${first}"]`).evaluate(el => /** @type {HTMLElement} */ (el).style.transform)
  assert.match(moved, /translateX\((?!0px)/, 'the dragged tab follows the pointer')
  await page.mouse.up()
  assert.equal(await page.locator('.tab.dragging').count(), 0, 'the drag ends on release')
  assert.equal(await page.locator(`.tab[data-tab-id="${first}"]`).evaluate(el => /** @type {HTMLElement} */ (el).style.transform), '', 'the held tab settles into its slot')
  assert.equal(await page.locator(`.tab[data-tab-id="${first}"] [role="tab"]`).evaluate(el => el === document.activeElement), true, 'the dropped tab keeps the focus')
  assert.equal(await active(), chosen, 'dragging leaves the active tab alone')
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]').map(item => item.id))
  assert.deepEqual(kept, [second, third, first], 'the order is kept for the next visit')

  // A new press spends the release click left over from the drag.
  await page.locator(`.tab[data-tab-id="${first}"] [role="tab"]`).click()
  assert.equal(await active(), first, 'a later click on the dropped tab chooses it')
  await page.locator(`.tab[data-tab-id="${second}"] [role="tab"]`).click()
  assert.equal(await active(), second, 'a click still chooses its tab')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })
  assert.deepEqual(await order(), [second, third, first], 'the next visit keeps the order')

  // Shift with the arrow keys moves the focused tab one place and keeps its focus.
  await page.locator(`.tab[data-tab-id="${second}"] [role="tab"]`).focus()
  await page.keyboard.press('Shift+ArrowRight')
  assert.deepEqual(await order(), [third, second, first], 'Shift+ArrowRight moves the focused tab right')
  assert.equal(await page.locator(`.tab[data-tab-id="${second}"] [role="tab"]`).evaluate(el => el === document.activeElement), true, 'the moved tab keeps the focus')
  await page.keyboard.press('Shift+ArrowLeft')
  assert.deepEqual(await order(), [second, third, first], 'Shift+ArrowLeft moves it back')

  // Dragging the tab being edited keeps its place in the workspace, only its place in the strip moves.
  const value = () => page.locator('.ids-field input').inputValue()
  await page.locator('.ids-field input').fill('⿰木口')
  const text = await value()
  const from = await box(second), to = await box(first)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2 + 10, to.y + to.height / 2, { steps: 20 })
  await page.mouse.up()
  assert.deepEqual(await order(), [third, first, second], 'the edited tab moves to the end')
  assert.equal(await active(), second, 'the edited tab stays active')
  assert.equal(await value(), text, 'its editor stays where it was')

  // A wobble that crosses no neighbour is still a click on that tab.
  const wobble = await box(third)
  await page.mouse.move(wobble.x + wobble.width / 2, wobble.y + wobble.height / 2)
  await page.mouse.down()
  await page.mouse.move(wobble.x + wobble.width / 2 + 10, wobble.y + wobble.height / 2)
  await page.mouse.up()
  assert.equal(await active(), third, 'a drag that crosses no tab still chooses its tab')
  assert.deepEqual(await order(), [third, first, second], 'that wobble leaves the order alone')

  // A strip of tabs wider than the window scrolls by itself while a tab is held at its edge.
  await page.setViewportSize({ width: 375, height: 812 })
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'New tab', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.tabbar .tab').length === 5)
  const strip = page.locator('.tabs')
  const wide = await strip.evaluate(el => el.scrollWidth > el.clientWidth + 2)
  assert.equal(wide, true, 'five tabs overflow the narrow strip')
  await strip.evaluate(el => { el.scrollLeft = 0 })
  const before = await order()
  // Show the first tab, so its reveal does not scroll the strip while it is being dragged.
  await page.locator(`.tab[data-tab-id="${before[0]}"] [role="tab"]`).click()
  assert.equal(await strip.evaluate(el => el.scrollLeft), 0, 'the strip starts at its first tab')
  const held = await box(before[0]), edge = await strip.boundingBox()
  await page.mouse.move(held.x + held.width / 2, held.y + held.height / 2)
  await page.mouse.down()
  await page.mouse.move(edge.x + edge.width - 6, held.y + held.height / 2, { steps: 6 })
  await page.waitForFunction(first => {
    const ids = [...document.querySelectorAll('.tabbar .tab')].map(el => /** @type {HTMLElement} */ (el).dataset.tabId)
    return ids[ids.length - 1] === first && document.querySelector('.tabs').scrollLeft > 0
  }, before[0], { timeout: 15000 })
  await page.mouse.up()
  assert.deepEqual(await order(), [...before.slice(1), before[0]], 'the held tab lands last as the strip scrolls')

  // A release whose pointerup the page never sees still ends the drag and its edge scroll.
  await strip.evaluate(el => { el.scrollLeft = 0 })
  const again = (await order())[0]
  await page.locator(`.tab[data-tab-id="${again}"] [role="tab"]`).click()
  const grip = await box(again), bound = await strip.boundingBox()
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(bound.x + bound.width - 6, grip.y + grip.height / 2, { steps: 6 })
  await page.waitForFunction(() => document.querySelector('.tabs').scrollLeft > 10)
  await page.evaluate(() => document.addEventListener('pointerup', event => event.stopImmediatePropagation(), { capture: true, once: true }))
  await page.mouse.up()
  assert.equal(await page.locator('.tab.dragging').count(), 0, 'a missed release ends the drag')
  const frozen = await order()
  await page.waitForTimeout(700)
  assert.deepEqual(await order(), frozen, 'no more swaps after a missed release')

  // A window with no session of its own opens on the order left in local storage.
  const keptOrder = await order()
  const next = await page.context().newPage()
  await next.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await next.locator('.ids-field input').waitFor({ timeout: 120000 })
  assert.deepEqual(await next.locator('.tabbar .tab').evaluateAll(els => els.map(el => /** @type {HTMLElement} */ (el).dataset.tabId)), keptOrder, 'a new window opens with the saved order')
  await next.close()

  assert.deepEqual(errors, [])
  console.log('PASS drag reorders tabs, keeps the active tab, persists the order, and ends cleanly')
} finally { await browser.close() }
