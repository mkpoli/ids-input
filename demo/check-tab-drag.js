// Tabs keep their order when dragged sideways: the dragged tab follows the pointer, the strip
// reorders while it moves, the active tab and its editor stay put, and the order is kept for the
// next visit. Shift with the arrow keys moves the focused tab too. Run against a devrun server:
//   IDS_URL=http://localhost:5196 CHROMIUM_PATH=/path/to/chrome bun demo/check-tab-drag.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor()
  // Three tabs, the last one active.
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'New tab', exact: true }).click()
  const order = () => page.locator('.tabbar .tab').evaluateAll(els => els.map(el => /** @type {HTMLElement} */ (el).dataset.tabId))
  const active = () => page.locator('.tabbar .tab.on').getAttribute('data-tab-id')
  const box = async id => {
    const found = await page.locator(`.tab[data-tab-id="${id}"]`).boundingBox()
    assert.ok(found, `tab ${id} has a box`)
    return found
  }
  const [first, second, third] = await order()
  assert.equal((await order()).length, 3, 'three tabs are open')
  const chosen = await active()

  // Drag the first tab past the last one: it takes the last place while the pointer is still down,
  // the strip marks it as dragged, and neither the active tab nor its editor follows it.
  const start = await box(first), end = await box(third)
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2 + 10, end.y + end.height / 2, { steps: 20 })
  assert.deepEqual(await order(), [second, third, first], 'the dragged tab takes the place under the pointer')
  assert.equal(await page.locator('.tab.dragging').count(), 1, 'the dragged tab is marked')
  const moved = await page.locator(`.tab[data-tab-id="${first}"]`).evaluate(el => /** @type {HTMLElement} */ (el).style.transform)
  assert.match(moved, /translateX\((?!0px)/, 'the dragged tab follows the pointer')
  await page.mouse.up()
  assert.equal(await page.locator('.tab.dragging').count(), 0, 'the drag ends on release')
  assert.equal(await active(), chosen, 'dragging leaves the active tab alone')
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]').map(item => item.id))
  assert.deepEqual(kept, [second, third, first], 'the order is kept for the next visit')

  // A press that does not move is still a click, and a drag that ends elsewhere is not.
  await page.locator(`.tab[data-tab-id="${second}"] [role="tab"]`).click()
  assert.equal(await active(), second, 'a click still chooses its tab')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.ids-field input').waitFor()
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

  // A strip of tabs wider than a phone scrolls under a tab held at its edge.
  await page.setViewportSize({ width: 375, height: 812 })
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'New tab', exact: true }).click()
  await page.waitForTimeout(200)
  const strip = page.locator('.tabs')
  const wide = await strip.evaluate(el => el.scrollWidth > el.clientWidth + 2)
  assert.equal(wide, true, 'five tabs overflow the phone strip')
  await strip.evaluate(el => { el.scrollLeft = 0 })
  assert.equal(await strip.evaluate(el => el.scrollLeft), 0, 'the strip starts at its first tab')
  const before = await order()
  const held = await box(before[0]), edge = await strip.boundingBox()
  await page.mouse.move(held.x + held.width / 2, held.y + held.height / 2)
  await page.mouse.down()
  for (let i = 0; i < 3; i++) await page.mouse.move(edge.x + edge.width - 6, held.y + held.height / 2, { steps: 6 })
  await page.mouse.up()
  assert.ok(await strip.evaluate(el => el.scrollLeft) > 0, 'the strip scrolls while a tab is held at its edge')
  assert.notDeepEqual(await order(), before, 'the held tab lands past the tabs the strip scrolled by')

  assert.deepEqual(errors, [])
  console.log('PASS drag reorders tabs, keeps the active tab, and persists the order')
} finally { await browser.close() }
