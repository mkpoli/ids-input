// Draw the fixed benchmark through the Find tab's pad and check whole-character recall. Run against
// a local server with IDS_URL and CHROMIUM_PATH, like the other demo checks.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const benchmark = JSON.parse(readFileSync(new URL('./model/benchmark.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5186'}?lang=en`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-field input').waitFor()
  await page.getByRole('tab', { name: 'Find' }).click()
  await page.locator('.ids-draw-toggle').click()
  await page.locator('canvas.pad').waitFor()
  await page.waitForFunction(() => !document.querySelector('.ids-sketch .bar'), null, { timeout: 60000 })

  const box = await page.locator('canvas.pad').boundingBox()
  const at = ([x, y]) => [box.x + x / 100 * box.width, box.y + y / 100 * box.height]
  const clear = page.locator('.ids-sketch').getByRole('button', { name: 'Clear', exact: true })
  let hits = 0
  const misses = []
  for (const [index, { char, strokes }] of benchmark.entries()) {
    if (await clear.isEnabled()) await clear.click()
    for (const line of strokes) {
      await page.mouse.move(...at(line[0]))
      await page.mouse.down()
      for (const point of line.slice(1)) await page.mouse.move(...at(point), { steps: 8 })
      await page.mouse.up()
    }
    const group = page.locator('.ids-sketch .group').filter({ hasText: 'Characters' })
    await group.waitFor({ timeout: index === 0 ? 120000 : 30000 })
    const found = await page.locator('.ids-sketch .found').first().locator('.hit').allTextContents()
    assert.ok(found.every(part => !/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(part)), `no kana in the English interface: ${found.join(' ')}`)
    if (found.includes(char)) hits++
    else misses.push(`${char} (${found.slice(0, 6).join(' ')})`)
  }
  console.log(`character drawings: ${hits}/${benchmark.length} in the top 24${misses.length ? `; missed ${misses.join(', ')}` : ''}`)
  assert.ok(hits / benchmark.length >= 0.9, `at least 90% in the top 24, got ${hits}/${benchmark.length}`)
  console.log('PASS character drawings')
} finally {
  await browser.close()
}
