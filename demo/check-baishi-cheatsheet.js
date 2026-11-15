// Run against a local devrun server with IDS_URL. The cheatsheet draws every card in both schemes
// and at a phone's width without an error or a sideways scroll: every quotation has a drawing, every
// coloured token has strokes of its colour beside it, and a sequence on a wide window stays on one
// line. Pointing at a token, or focusing it, shows what it is and lights its strokes; a tile opens
// enlarged. Every anchor the specification links to is on the page, and every link from the page to
// the specification lands on an anchor there. IDS_PAGE_SHOTS saves each view.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { anchorsOf, cardsOf } from './lib/baishi-cheatsheet.js'
const base = process.env.IDS_URL ?? 'http://localhost:5186'
const shots = process.env.IDS_PAGE_SHOTS
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const cards = cardsOf()
try {
  // The anchors of the specification, read from its own page.
  const spec = await browser.newPage()
  await spec.goto(`${base}/baishi.html?lang=ja`, { waitUntil: 'networkidle' })
  const specAnchors = new Set(await spec.evaluate(() => [...document.querySelectorAll('[id]')].map(element => element.id)))
  const back = await spec.evaluate(() => [...document.querySelectorAll('a[href*="baishi-cheatsheet.html"]')].map(link => /** @type {HTMLAnchorElement} */ (link).hash.slice(1)).filter(Boolean))
  await spec.close()

  for (const scheme of /** @type {const} */ (['light', 'dark'])) for (const [name, width] of /** @type {const} */ ([['desktop', 1360], ['phone', 400]])) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/baishi-cheatsheet.html?lang=ja`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const view = `${name} ${scheme}`
    assert.equal(await page.locator('article.card:not(.unused):not(.legend)').count(), cards.length, `${view}: every card is drawn`)
    assert.equal(await page.locator('.quote:has(.sequence):not(:has(.tile .glyph))').count(), 0, `${view}: every quotation has a drawing`)
    assert.equal(await page.locator('.tile .glyph').count(), cards.flatMap(card => card.quotes).reduce((sum, quote) => sum + quote.glyphs.filter(Boolean).length, 0), `${view}: every tile is drawn`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${view}: the page does not scroll sideways`)
    // A coloured token names strokes: its quotation draws a part of that colour.
    const orphans = await page.evaluate(() => [...document.querySelectorAll('.quote')].flatMap(quote => ['s0', 's1', 's2', 's3']
      .filter(slot => quote.querySelector(`.token.${slot}`) && !quote.querySelector(`.part.${slot}`)).map(slot => `${quote.textContent?.trim()} ${slot}`)))
    assert.deepEqual(orphans, [], `${view}: no colour without its strokes`)
    // Text in a part's colour reads on the card: 4.5 to 1 against the card's surface.
    const contrasts = await page.evaluate(() => {
      const channel = (/** @type {number} */ value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
      const luminance = (/** @type {string} */ colour) => { const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) }
      const card = getComputedStyle(/** @type {Element} */ (document.querySelector('article.card'))).backgroundColor
      return ['s0', 's1', 's2', 's3'].map(slot => {
        const [light, dark] = [luminance(getComputedStyle(/** @type {Element} */ (document.querySelector(`.token.${slot}`))).color), luminance(card)].sort((a, b) => b - a)
        return (light + 0.05) / (dark + 0.05)
      })
    })
    for (const [slot, contrast] of contrasts.entries()) assert.ok(contrast >= 4.5, `${view}: part colour ${slot} has ${contrast.toFixed(2)} to 1 on the card`)

    // Every anchor the two pages share is here, and every link to the specification lands there.
    const here = new Set(await page.evaluate(() => [...document.querySelectorAll('[id]')].map(element => element.id)))
    for (const id of anchorsOf()) assert.ok(here.has(id), `${view}: #${id} is on the cheatsheet`)
    for (const id of back) assert.ok(here.has(id), `${view}: the specification's link to #${id} lands on the cheatsheet`)
    const out = await page.evaluate(() => [...document.querySelectorAll('main a[href^="./baishi.html"]')].map(link => /** @type {HTMLAnchorElement} */ (link).hash.slice(1)))
    assert.ok(out.length >= anchorsOf().length - 12, `${view}: the sections and cards link to the specification`)
    for (const id of out) assert.ok(specAnchors.has(id), `${view}: the cheatsheet's link to #${id} lands on the specification`)
    assert.equal(await page.locator('header.bar a[href^="./baishi.html"]').count(), 1, `${view}: the header links to the specification`)

    if (name === 'desktop') {
      // Wide enough, a sequence stands on one line: every token of a card's quotation shares a line.
      const wrapped = await page.evaluate(() => [...document.querySelectorAll('.sequence')].filter(sequence => {
        // Chunks on one line share a foot, whatever ruby stands over them.
        const feet = [...sequence.querySelectorAll('.chunk')].map(chunk => chunk.getBoundingClientRect().bottom)
        return Math.max(...feet) - Math.min(...feet) > 12
      }).map(sequence => sequence.textContent))
      assert.deepEqual(wrapped, [], `${scheme}: no sequence wraps on a wide window`)
      // An entry that nests has the workshop's scope lines under it.
      assert.ok(await page.locator('#worked .sequence-scopes .scope-lead').count() >= 8, `${scheme}: scope lines run under the worked examples`)
      // Pointing at a component with a tag: the tooltip says what it is and lists its row, and the other part dims.
      const token = page.locator('#component-variant .token.part.s1').first()
      await token.scrollIntoViewIfNeeded()
      await token.hover()
      const tip = page.getByRole('tooltip')
      await tip.waitFor()
      assert.ok((await tip.locator('p').count()) >= 2, `${scheme}: the tooltip names the token and says what it does`)
      assert.ok((await tip.locator('.variants li').count()) >= 2, `${scheme}: the tooltip lists the component's entries`)
      assert.equal(await page.locator('#component-variant .card').first().locator('.part.dim').count(), 1, `${scheme}: the other part dims`)
      if (shots) await page.screenshot({ path: `${shots}/baishi-cheatsheet-tooltip-${scheme}.png` })
      await page.mouse.move(0, 0)
      assert.equal(await tip.count(), 0, `${scheme}: the tooltip leaves with the pointer`)
      // Focus does the same.
      await token.focus()
      await tip.waitFor()
      assert.equal(await token.getAttribute('aria-describedby'), 'cheatsheet-tip', `${scheme}: the focused token is described by the tooltip`)
      await page.keyboard.press('Escape')
      assert.equal(await tip.count(), 0, `${scheme}: Escape closes the tooltip`)
      // A stroke's number stands over it as ruby, outside the sequence's text.
      assert.equal(await page.locator('#crossing .token.stroke rt').allTextContents().then(texts => texts.join('')), '01', `${scheme}: strokes are numbered in ruby`)
      // A tile opens enlarged, with its sequence beside it.
      await page.locator('#crossing .tile').click()
      const dialog = page.getByRole('dialog')
      assert.equal(await dialog.locator('.big .glyph').count(), 1, `${scheme}: the glyph opens enlarged`)
      assert.ok(await dialog.locator('.sequence .token').count() > 3, `${scheme}: with its sequence beside it`)
      if (shots) await page.screenshot({ path: `${shots}/baishi-cheatsheet-zoom-${scheme}.png` })
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('dialog[open]').count(), 0, `${scheme}: Escape closes the enlarged glyph`)
      await page.getByRole('button', { name: 'この早見表について' }).click()
      assert.equal(await page.getByRole('dialog').locator('li').count(), 7, `${scheme}: the help dialog lists its notes`)
      await page.keyboard.press('Escape')
    }
    if (shots) await page.screenshot({ path: `${shots}/baishi-cheatsheet-${name}-${scheme}.png`, fullPage: true })
    assert.deepEqual(errors, [], `${view}: no page error`)
    await page.close()
  }
  console.log('baishi cheatsheet: ok')
} finally {
  await browser.close()
}
