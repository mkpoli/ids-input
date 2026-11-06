// A tab's preview is the composed drawing, so an emoji in the description is drawn there too, in
// its own colours beside the ink, in the scoped export's paint order, and with its cut and restored
// parts masked the same way. Run against a devrun server:
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

  /** Type a description and wait for its emoji to reach the active tab's preview. @param {string} sequence @param {string} text */
  async function draw(sequence, text) {
    // The tab keeps the last drawing until the next one arrives, so an emoji already on the strip
    // would answer for the new sequence: empty the field and wait for that drawing to go first.
    await page.locator('.ids-field input').fill('')
    await page.waitForFunction(() => !document.querySelector('.tabbar .tab.on .tab-glyph text'), null, { timeout: 120000 })
    await page.locator('.ids-field input').fill(sequence)
    await page.waitForFunction(({ sequence, text }) => {
      const field = document.querySelector('.ids-field input')
      const svg = document.querySelector('.tabbar .tab.on .tab-glyph')
      return field?.value === sequence && [...(svg?.querySelectorAll('text') ?? [])].some(node => node.textContent === text)
    }, { sequence, text }, { timeout: 120000 })
  }

  // The scoped export paints the parts in their own order: the ink, then the emoji over it.
  await draw('⿻🚗車', '🚗')
  const order = await glyph.evaluate(svg => [...svg.children]
    .filter(node => node.tagName === 'path' || node.tagName === 'text')
    .map(node => node.tagName))
  assert.deepEqual(order, ['path', 'text'], 'the emoji is painted over the ink, as the scoped export paints it')

  // A cut emoji is part of the ink's mask; a restored one is painted outside it.
  await draw('㇯車🚗', '🚗')
  const cut = glyph.locator('mask text[filter]')
  assert.equal(await cut.count(), 1, 'the cut emoji is in the mask')
  assert.match((await cut.getAttribute('filter')) ?? '', /-emoji-cut/, 'the cut emoji takes the luminance filter')
  assert.equal(await glyph.locator('path[mask]').count(), 1, 'the ink is masked for the cut')

  await draw('㇯口㇯木😀', '😀')
  const restored = glyph.locator('text', { hasText: '😀' })
  assert.equal(await restored.evaluate(node => node.closest('mask') === null), true, 'the restored emoji is painted outside the mask')
  assert.equal(await restored.getAttribute('mask'), null, 'the restored emoji takes no mask')
  assert.equal(await glyph.locator('path[mask]').count(), 1, 'the ink is still masked')

  await page.locator('.tabbar').screenshot({ path: process.env.SHOT ?? '/tmp/tab-emoji.png' })
  assert.deepEqual(errors, [])
  console.log('PASS a tab preview draws emoji in the scoped export order, with cut masks and restored items')
} finally { await browser.close() }
