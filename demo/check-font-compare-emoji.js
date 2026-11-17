// The font comparison draws every cell through FontDrawing. An Emoji part has no outline: the
// composer returns it in `drawing.emoji`, and FontDrawing must draw it as text in its box. This
// checks the car row in the Examples set, where 車 is an outline and 🚗 is an Emoji.
//
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=… bun demo/check-font-compare-emoji.js
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { strict as assert } from 'node:assert'

const out = process.env.SHOTS ?? '/tmp/font-compare-emoji'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const dark = process.env.THEME === 'dark'
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' })
  if (dark) await context.addInitScript(() => localStorage.setItem('ids-input:theme', JSON.stringify('dark')))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5199'}/font-compare.html?lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('select.ui-select').waitFor({ timeout: 120000 })
  await page.locator('select.ui-select').selectOption('examples')
  await page.waitForFunction(() => document.querySelectorAll('.row').length === 20, null, { timeout: 30000 })
  await page.addStyleTag({ content: 'header.bar,.head{display:none!important}' })
  // The five faces draw through one queue each. Let a page finish before turning it, so a later
  // page is not queued behind drawings nobody will see.
  for (let i = 1; i < 6; i++) {
    await page.waitForFunction(() => {
      const cells = [...document.querySelectorAll('.row .cell')]
      return cells.length === 100 && cells.every(cell => cell.querySelector('svg path') || cell.querySelector('svg text'))
    }, null, { timeout: 300000 })
    const before = await page.locator('.row .label b').first().textContent()
    await page.locator('.controls .pager button').nth(1).click()
    await page.waitForFunction(before => document.querySelector('.row .label b')?.textContent !== before, before, { timeout: 30000 })
  }
  const row = page.locator('.row').filter({ has: page.locator('b', { hasText: '⿱車🚗' }) }).first()
  await row.waitFor({ timeout: 30000 })
  await row.scrollIntoViewIfNeeded()
  const cell = row.locator('.cell').nth(4)
  // Every face draws 車 and the car; the five workers finish at different times.
  await page.waitForFunction(sequence => {
    const row = [...document.querySelectorAll('.row')].find(candidate => candidate.querySelector('b')?.textContent === sequence)
    const cells = [...(row?.querySelectorAll('.cell') ?? [])]
    return cells.length === 5 && cells.every(candidate => candidate.querySelector('svg path') && candidate.querySelector('svg text'))
  }, '⿱車🚗', { timeout: 120000 })
  const emoji = cell.locator('svg text')
  assert.equal(await emoji.textContent(), '🚗', 'the WenKai cell draws the Emoji as text')
  const ink = await emoji.evaluate(node => {
    const box = node.getBBox()
    return box ? { width: box.width, height: box.height } : null
  })
  assert.ok(ink && ink.width > 0 && ink.height > 0, 'the Emoji has ink')
  assert.ok(ink.width <= 1000 && ink.height <= 1000, `the Emoji stays inside the drawing box (${ink.width}×${ink.height})`)
  assert.ok(await cell.locator('svg path').count(), 'the cell still draws 車')
  await row.screenshot({ path: `${out}/car-after-${dark ? 'dark' : 'light'}.png` })
  assert.deepEqual(errors, [])
  console.log('PASS the font comparison draws an Emoji part in every face')
} finally {
  await browser.close()
}
