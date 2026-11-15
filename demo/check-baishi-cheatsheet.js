// Run against a local devrun server with IDS_URL. The cheatsheet draws every card in both schemes
// and at a phone's width without an error or a sideways scroll, every coloured piece of a
// quotation has strokes of its colour beside it, a card's hint opens, and the part colours keep
// their contrast on the card. IDS_PAGE_SHOTS saves each view.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { SECTIONS } from './lib/baishi-cheatsheet.js'
const base = process.env.IDS_URL ?? 'http://localhost:5186'
const shots = process.env.IDS_PAGE_SHOTS
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const cards = SECTIONS.flatMap(section => section.cards)
try {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) for (const [name, width] of /** @type {const} */ ([['desktop', 1360], ['phone', 400]])) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/baishi-cheatsheet.html?lang=ja`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('article.card:not(.unused):not(.legend)').count(), cards.length, `${name} ${scheme}: every card is drawn`)
    assert.equal(await page.locator('svg.tile').count(), cards.flatMap(card => card.quotes).reduce((sum, quote) => sum + (quote.glyphs ?? []).filter(Boolean).length + (quote.chain ? 1 : 0), 0), `${name} ${scheme}: every tile is drawn`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${name} ${scheme}: the page does not scroll sideways`)
    // A coloured piece of text names strokes: its quotation draws a part or a stroke of that colour.
    const orphans = await page.evaluate(() => [...document.querySelectorAll('.quote')].flatMap(quote => ['s0', 's1', 's2', 's3']
      .filter(slot => quote.querySelector(`.tok.${slot}`) && !quote.querySelector(`.part.${slot}, .stroke.${slot}`) && !quote.closest('.card')?.querySelector(`.part.${slot}`))
      .map(slot => `${quote.textContent?.trim()} ${slot}`)))
    assert.deepEqual(orphans, [], `${name} ${scheme}: no colour without its strokes`)
    // Text in a part's colour reads on the card: 4.5 to 1 against the card's surface.
    const contrasts = await page.evaluate(() => {
      const channel = (/** @type {number} */ value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
      const luminance = (/** @type {string} */ colour) => { const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) }
      const card = getComputedStyle(/** @type {Element} */ (document.querySelector('article.card'))).backgroundColor
      return ['s0', 's1', 's2', 's3'].map(slot => {
        const [light, dark] = [luminance(getComputedStyle(/** @type {Element} */ (document.querySelector(`.tok.${slot}`))).color), luminance(card)].sort((a, b) => b - a)
        return (light + 0.05) / (dark + 0.05)
      })
    })
    for (const [slot, contrast] of contrasts.entries()) assert.ok(contrast >= 4.5, `${name} ${scheme}: part colour ${slot} has ${contrast.toFixed(2)} to 1 on the card`)
    if (name === 'desktop') {
      const about = page.locator('#chains details.about').first()
      await about.locator('summary').click()
      assert.equal(await about.evaluate(element => /** @type {HTMLDetailsElement} */ (element).open), true, `${scheme}: a card's hint opens`)
      await about.locator('summary').click()
      await page.getByRole('button', { name: 'この早見表について' }).click()
      assert.equal(await page.getByRole('dialog').locator('li').count(), 5, `${scheme}: the help dialog lists its notes`)
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('dialog[open]').count(), 0, `${scheme}: Escape closes the help`)
    }
    if (shots) await page.screenshot({ path: `${shots}/baishi-cheatsheet-${name}-${scheme}.png`, fullPage: true })
    assert.deepEqual(errors, [], `${name} ${scheme}: no page error`)
    await page.close()
  }
  console.log('baishi cheatsheet: ok')
} finally {
  await browser.close()
}
