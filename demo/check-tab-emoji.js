// A tab's preview is the composed drawing, so an emoji in the description is drawn there too, in
// its own colours beside the ink. Run against a devrun server:
//   IDS_URL=http://localhost:5186 bun demo/check-tab-emoji.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const tab = { id: 'tab-car', sequence: '⿱車🚘', saved: '⿱車🚘' }
  await context.addInitScript(({ tab }) => {
    localStorage.setItem('ids-input:tabs', JSON.stringify([tab]))
    localStorage.setItem('ids-input:activeTab', JSON.stringify(tab.id))
  }, { tab })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })
  assert.equal(await page.locator('.ids-field input').inputValue(), tab.sequence, 'the tab holds the description')

  const glyph = page.locator('.tabbar .tab .tab-glyph')
  const emoji = glyph.locator('text')
  await emoji.waitFor({ timeout: 120000 })
  assert.equal(await emoji.textContent(), '🚘', 'the tab draws the emoji as text')
  assert.equal(await glyph.locator('path').count(), 1, 'the tab still draws the description ink')
  const ink = await emoji.evaluate(node => {
    const box = node.getBBox()
    const svg = node.ownerSVGElement
    return box && svg ? { width: box.width, height: box.height, viewBox: svg.getAttribute('viewBox') } : null
  })
  assert.ok(ink && ink.width > 0 && ink.height > 0, 'the emoji has ink')
  assert.ok(ink.width < 800 && ink.height < 800, `the emoji takes its layout box, not the frame (${ink.width}×${ink.height})`)
  assert.equal(ink.viewBox, '0 0 1000 1000', 'it is placed in the drawing box')

  await page.locator('.tabbar').screenshot({ path: process.env.SHOT ?? '/tmp/tab-emoji.png' })
  assert.deepEqual(errors, [])
  console.log('PASS a tab preview draws the emoji in the composed drawing')
} finally { await browser.close() }
