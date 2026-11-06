// Run against a dev server: IDS_URL=http://localhost:5288 bun demo/check-character-strokes.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5288'
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(url)
  // The find tab names a component, and every hit says how many strokes it has and how it starts.
  await page.getByRole('tab', { name: 'Find', exact: true }).click()
  const field = page.locator('.ids-find input[type="search"]').first()
  await field.fill('木')
  const hit = page.locator('.ids-hit[data-character="木"]').first()
  await hit.waitFor()
  const title = await hit.getAttribute('title')
  assert.match(title, /4 strokes/, `the tooltip gives the stroke count, got ${title}`)
  assert.match(title, /㇐ Horizontal/, `the tooltip gives the first stroke, got ${title}`)

  await field.fill('水')
  const water = page.locator('.ids-hit[data-character="水"]').first()
  await water.waitFor()
  assert.match(await water.getAttribute('title'), /㇑ Vertical/, 'a vertical first stroke is named')

  // Hovering opens the character card, which adds the same facts under the code point.
  await water.hover()
  const card = page.locator('.ids-character-info')
  await card.waitFor({ state: 'visible', timeout: 5000 })
  // The panel puts both facts on one line about strokes: the count, then the stroke glyph.
  const facts = await card.locator('.stroke-facts').innerText()
  const line = facts.replace(/\s+/g, ' ')
  assert.equal(line, '4 strokes first ㇑', `the panel gives the stroke count with its unit, then the first stroke, got ${JSON.stringify(line)}`)
  // The class name is not on the line; the glyph carries it, so hovering the glyph still says which.
  assert.equal(await card.locator('.stroke-glyph').getAttribute('title'), 'Vertical', 'the glyph names its class on hover')
  const box = await card.locator('.stroke-facts').boundingBox()
  assert.ok(box && box.height < 30, `the stroke line does not wrap, got ${box?.height}px tall`)
  assert.match(await card.innerText(), /U\+6C34/, 'the code point stays')
  await page.screenshot({ path: 'shots/character-strokes-card-light.png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'shots/character-strokes-card-dark.png' })
  await context.close()
  console.log('PASS the tooltip and the card give a character\'s stroke count and first stroke')
} finally {
  await browser.close()
}
