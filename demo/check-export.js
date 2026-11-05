// Run against a local devrun server with IDS_URL.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { DEFAULTS } from './lib/exporting.js'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  // A fresh context has no saved export settings: the defaults are PNG on white.
  assert.equal(await page.getByRole('radio', { name: 'PNG', exact: true }).isChecked(), true, 'PNG is the default format')
  assert.equal(await page.getByRole('radio', { name: 'White', exact: true }).isChecked(), true, 'white is the default background')
  assert.equal(await page.evaluate(() => localStorage.getItem('ids-input:export')), null, 'opening the panel writes no record')
  const field = page.locator('.ids-field input')
  await field.fill('⿰木⬚')
  await field.press('Tab')
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  // The default download carries the white background, not only the selected swatch.
  const pngWait = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save PNG/i }).click()
  const pngPath = await (await pngWait).path()
  assert.ok(pngPath, 'the PNG downloaded')
  const shot = await page.evaluate(async b64 => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + b64
    await image.decode()
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height })
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return { size: [image.width, image.height], corner: [...context.getImageData(0, 0, 1, 1).data] }
  }, readFileSync(pngPath).toString('base64'))
  assert.deepEqual(shot.size, [1024, 1024], 'the default PNG is 1024 square')
  assert.deepEqual(shot.corner, [255, 255, 255, 255], 'the default PNG has an opaque white corner')
  // This check reads the SVG, so choose it and a transparent background, as a viewer's own settings.
  await page.getByRole('radio', { name: 'SVG', exact: true }).click()
  await page.getByRole('radio', { name: 'Transparent', exact: true }).click()
  const save = async () => {
    const wait = page.waitForEvent('download')
    await page.getByRole('button', { name: /Save SVG/i }).click()
    const path = await (await wait).path()
    assert.ok(path, 'the SVG downloaded')
    return readFileSync(path, 'utf8')
  }
  const toggle = page.getByLabel('Include empty slots')
  await toggle.check()
  const withSlots = await save()
  assert.ok(withSlots.includes('stroke-dasharray="12 8"'), 'empty slots are exported')
  await toggle.uncheck()
  const withoutSlots = await save()
  assert.ok(!withoutSlots.includes('stroke-dasharray="12 8"'), 'empty slots are omitted')
  await page.reload({ waitUntil: 'domcontentloaded' })
  assert.equal(await page.getByRole('radio', { name: 'SVG', exact: true }).isChecked(), true, 'the chosen format survives a reload')
  assert.equal(await page.getByRole('radio', { name: 'Transparent', exact: true }).isChecked(), true, 'the chosen background survives a reload')
  // A record written before the defaults changed: the format and background it left at the old
  // defaults take the new ones, while the size it chose stays.
  const legacy = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await legacy.addInitScript(settings => localStorage.setItem('ids-input:export', JSON.stringify(settings)), { ...DEFAULTS, format: 'svg', background: 'none', size: 2048 })
  const upgraded = await legacy.newPage()
  await upgraded.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  assert.equal(await upgraded.getByRole('radio', { name: 'PNG', exact: true }).isChecked(), true, 'a legacy record takes the PNG default')
  assert.equal(await upgraded.getByRole('radio', { name: 'White', exact: true }).isChecked(), true, 'a legacy record takes the white default')
  assert.equal(await upgraded.getByLabel('Size', { exact: true }).inputValue(), '2048', 'the size a legacy record chose stays')
  await legacy.close()
  console.log('PASS export starts as PNG on white, keeps saved choices across reloads, and brings a legacy record to the new defaults')
} finally { await browser.close() }
