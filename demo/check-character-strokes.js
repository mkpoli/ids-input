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
  const text = await card.innerText()
  assert.match(text, /4 strokes/, `the card gives the stroke count, got: ${text.slice(0, 200)}`)
  assert.match(text, /First stroke:\s*㇑ Vertical/, `the card gives the first stroke, got: ${text.slice(0, 200)}`)
  assert.match(text, /U\+6C34/, 'the code point stays')
  await page.screenshot({ path: 'shots/character-strokes-card-light.png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'shots/character-strokes-card-dark.png' })
  await context.close()
  console.log('PASS the tooltip and the card give a character\'s stroke count and first stroke')
} finally {
  await browser.close()
}
