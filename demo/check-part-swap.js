// A part dragged onto a part of another branch switches places with it, a part onto an empty slot
// takes its place, and a part beside a sibling still moves. Run against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-part-swap.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const field = page.locator('.ids-field input')
  const value = () => field.inputValue()
  const open = async sequence => {
    await page.goto(`${url}/?ids=${encodeURIComponent(sequence)}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await page.waitForTimeout(600)
  }
  /** Drag from one box to another, the way a pointer does: press, leave the source, settle on the target.
   * A group is grabbed by its head band, where its parts do not sit; elsewhere the part under the
   * pointer is the one dragged.
   * @param {import('playwright-core').Locator} from @param {import('playwright-core').Locator} to @param {number} [grabY] */
  const drag = async (from, to, grabY) => {
    const a = await from.boundingBox(), b = await to.boundingBox()
    assert.ok(a && b, 'both boxes are on screen')
    const y = grabY === undefined ? a.y + a.height / 2 : a.y + grabY
    await page.mouse.move(a.x + a.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2 + 8, y + 8, { steps: 4 })
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForTimeout(400)
  }
  const part = index => page.locator('.ids-tree .ids-part').nth(index)

  await open('⿱⿰木口日')
  await drag(part(0), part(2))
  assert.equal(await value(), '⿱⿰日口木', 'a part dropped on a part of another branch switches with it')
  assert.equal(await page.locator('.ids-character-info').isVisible(), false, 'the character card stays out of the way while a part is dragged')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  assert.equal(await value(), '⿱⿰木口日', 'one undo puts the two parts back')

  await open('⿱⿰木⬚日')
  await drag(part(2), part(1))
  assert.equal(await value(), '⿱⿰木日⬚', 'a part dropped on an empty slot takes its place')

  await open('⿲木口日')
  await drag(part(0), part(2))
  assert.equal(await value(), '⿲口日木', 'a part dropped beside a sibling still moves')

  await open('⿱⿰木口⿱日火')
  const group = index => page.locator('.ids-tree .ids-node').nth(index)
  assert.equal(await group(1).getAttribute('draggable'), 'true', 'a whole group is draggable by its frame')
  await drag(group(1), part(3), 8)
  assert.equal(await value(), '⿱火⿱日⿰木口', 'a group dropped on a part of another branch switches with it')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  assert.equal(await value(), '⿱⿰木口⿱日火', 'one undo puts the group back')
  await drag(group(1), part(0), 8)
  assert.equal(await value(), '⿱⿰木口⿱日火', 'a group does not land inside itself')

  await open('⿱⿰木口日')
  await page.getByRole('tab', { name: 'Tree' }).click()
  const row = path => page.locator(`.ids-treelist [data-path="${path}"]`)
  await row('0.0').waitFor()
  await drag(row('0.0'), row('1'))
  assert.equal(await value(), '⿱⿰日口木', 'the list switches places the same way')

  assert.deepEqual(errors, [])
  console.log('PASS a part or group dragged onto another part switches places')
} finally { await browser.close() }
