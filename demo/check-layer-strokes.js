// Run against a local devrun server with IDS_URL. Edits one stroke of a component in the Layers dialog.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const composer = process.env.IDS_COMPOSER ? `?composer=${encodeURIComponent(process.env.IDS_COMPOSER)}` : ''
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5186'}/${composer}`, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.fill('⿰木口')
  await field.press('Tab')
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('img').waitFor({ timeout: 30000 })
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document)
  await dialog.getByRole('treeitem').nth(1).click()
  const strokes = dialog.locator('.strokes button')
  await strokes.first().waitFor({ timeout: 10000 })
  const first = dialog.locator('.strokes button').first()

  // The stroke selector stays usable beside a layer transform that has no affine form.
  await first.click()
  assert.equal(await first.getAttribute('aria-pressed'), 'true')
  const x = dialog.locator('input[type=number]').nth(0)
  await x.fill('300')
  await x.press('Tab')
  await page.waitForTimeout(500)
  let document = await stored()
  assert.equal(document.geometryEdits?.length, 1, 'the stroke has one edit')
  assert.equal(document.geometryEdits[0].transform[0].matrix[4], 300)

  // A drag starts from the stroke's own X, not from the selection box.
  const move = dialog.locator('.handle.move')
  const grip = await move.boundingBox()
  assert.ok(grip, 'the layer has a move handle')
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(grip.x + grip.width / 2 + step * 6, grip.y + grip.height / 2)
    await page.waitForTimeout(120)
  }
  await page.mouse.up()
  await page.waitForTimeout(500)
  document = await stored()
  assert.equal(document.geometryEdits?.length, 1, 'the drag edits the same record')
  const dragged = document.geometryEdits[0].transform[0].matrix[4]
  assert.ok(dragged > 300 && dragged < 700, `the drag moved the stroke from 300 (now ${dragged})`)

  // A whole gesture is one undo step.
  await dialog.locator('details.history summary').click()
  const steps = await dialog.locator('.history-list button').count()
  await x.fill('0')
  await x.press('Tab')
  await page.waitForTimeout(300)
  assert.ok(steps <= 4, `the drag made few history steps (${steps})`)

  // Two edits on one stroke read as one and reset together.
  await x.fill('10')
  await x.press('Tab')
  await page.waitForTimeout(300)
  document = await stored()
  assert.equal(document.geometryEdits?.length, 1)
  await dialog.getByRole('button', { name: 'Reset transform', exact: true }).click()
  await page.waitForTimeout(300)
  document = await stored()
  assert.equal(document.geometryEdits, undefined, 'reset clears the stroke edits')

  // A split drops the chosen stroke and re-enables the layer modes.
  await dialog.locator('.strokes button').first().click()
  await dialog.getByRole('treeitem').nth(1).dblclick()
  const splits = dialog.locator('.splits button')
  await splits.first().waitFor({ timeout: 10000 })
  await splits.first().click()
  await page.waitForTimeout(1000)
  assert.equal(await dialog.locator('.strokes').count(), 0, 'the stroke selector is gone after the split')
  assert.equal(await dialog.getByRole('button', { name: 'Matrix', exact: true }).isDisabled(), false, 'the layer modes work again')
  assert.deepEqual(errors, [])
  console.log('PASS layer stroke edits')
} finally { await browser.close() }
