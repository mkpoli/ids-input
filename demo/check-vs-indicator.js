// Characters carrying a variation selector (VS) are marked with their selector tag across the
// sequence field, shape tree, tree list, and parts palette; hovering any VS-modified character
// opens its details card with a form picker and direct VS selector.
// Run against a devrun server:
//   IDS_URL=http://127.0.0.1:5211 CHROMIUM_PATH=/path/to/chrome bun demo/check-vs-indicator.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5211'
const shots = process.env.IDS_VS_SHOTS
const DOTTED = '者\u{E0101}'
const VS17_ZHE = '者\u{E0100}'
const WOOD_VS1 = '木\uFE00'

try {
  if (shots) mkdirSync(shots, { recursive: true })
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    page.setDefaultTimeout(120000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent(`⿰氵${DOTTED}`)}`, { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    const panel = page.locator('.ids-character-info')
    await field.waitFor()

    // 1. Sequence field marks VS char and exposes its VS tag via data-vs.
    const seqSpan = page.locator('.sequence-paint span.varied[data-vs="VS18"]')
    await seqSpan.waitFor()
    assert.equal(await seqSpan.count(), 1)
    assert.equal(await seqSpan.getAttribute('data-character'), DOTTED)
    const afterContent = await seqSpan.evaluate(el => getComputedStyle(el, '::after').content)
    assert.equal(afterContent, '"VS18"', 'sequence field paints VS18 tag above the character')

    // 2. Shape tree marks VS part with class .vs, data-vs, and visible .ids-vs-badge.
    const treePart = page.locator('.ids-tree .ids-part.vs[data-vs="VS18"]')
    await treePart.waitFor()
    assert.equal(await treePart.locator('.ids-vs-badge').innerText(), 'VS18')

    // Wait for composer preview/icons to settle before screenshots.
    await page.waitForFunction(() => document.querySelector('#output-panel .ids-preview svg path')?.getAttribute('d'))
    await page.evaluate(() => document.fonts.ready)
    if (shots) await page.screenshot({ path: join(shots, `vs-marked-${scheme}.png`) })

    // 3. Hover on VS char in sequence field opens details card with VS details and selectable forms.
    const spanBox = await seqSpan.boundingBox()
    assert.ok(spanBox)
    await page.mouse.move(spanBox.x + spanBox.width / 2, spanBox.y - 6)
    await panel.waitFor({ state: 'visible' })
    assert.equal(await panel.locator('.vs-pill').innerText(), 'VS18')
    assert.equal(await panel.locator('header .code code').innerText(), 'U+8005 U+E0101')
    assert.match(await panel.locator('.vs-meta').innerText(), /Ideographic Variation Selector/)
    const options = panel.locator('.vs-option')
    await options.nth(1).waitFor()
    assert.equal(await panel.locator(`.vs-option[data-vs-option="${DOTTED}"]`).getAttribute('aria-pressed'), 'true')
    assert.equal(await panel.locator('.vs-option[data-vs-option="者"]').getAttribute('aria-pressed'), 'false')
    // Copy button copies the full VS sequence.
    await panel.locator('header .copy').click()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), DOTTED)
    if (shots) await page.screenshot({ path: join(shots, `vs-hover-seq-${scheme}.png`) })

    // 4. Selecting Plain from the hovercard removes the VS from that part.
    await panel.locator('.vs-option[data-vs-option="者"]').click()
    await panel.waitFor({ state: 'hidden' })
    assert.equal(await field.inputValue(), '⿰氵者')
    await page.keyboard.press('Control+z')
    assert.equal(await field.inputValue(), `⿰氵${DOTTED}`)

    // 5. Hover on VS part in shape tree opens details card; direct VS selector applies VS17.
    await treePart.hover()
    await panel.waitFor({ state: 'visible' })
    assert.equal(await panel.locator('.vs-pill').innerText(), 'VS18')
    if (shots) await page.screenshot({ path: join(shots, `vs-hover-tree-${scheme}.png`) })
    const vsInput = panel.locator('.vs-input')
    await vsInput.fill('VS17')
    await panel.locator('.vs-apply').click()
    await panel.waitFor({ state: 'hidden' })
    assert.equal(await field.inputValue(), `⿰氵${VS17_ZHE}`)
    assert.equal(await page.locator('.ids-tree .ids-part.vs[data-vs="VS17"] .ids-vs-badge').innerText(), 'VS17')

    // 6. Tree list shows VS tag and code point, and hovering an SVS char (木 + VS1) shows details & Plain select.
    await field.fill(`⿰${WOOD_VS1}${DOTTED}`)
    await page.locator('#tree-tab').click()
    const listWood = page.locator(`.ids-treelist li.vs[data-vs="VS1"]`)
    await listWood.waitFor()
    assert.equal(await listWood.locator('.vs-tag').innerText(), 'VS1')
    assert.equal(await listWood.locator('.name').innerText(), 'U+FE00')
    await listWood.hover()
    await panel.waitFor({ state: 'visible' })
    assert.equal(await panel.locator('.vs-pill').innerText(), 'VS1')
    assert.match(await panel.locator('.vs-meta').innerText(), /Standardized Variation Selector/)
    if (shots) await page.screenshot({ path: join(shots, `vs-hover-treelist-${scheme}.png`) })
    await panel.locator('.vs-option[data-vs-option="木"]').click()
    await panel.waitFor({ state: 'hidden' })
    assert.equal(await field.inputValue(), `⿰木${DOTTED}`)

    // 7. Code points dialog labels VS code points instead of blank glyphs.
    await page.locator('.points-btn').click()
    const pointVs = page.locator('.point-list .point-vs')
    await pointVs.waitFor()
    assert.equal(await pointVs.innerText(), 'VS18')
    await page.keyboard.press('Escape')

    // 8. Jurchen palette variants show VS tag and open hovercard with VS details.
    await page.locator('.parts-tabs [role="tab"]').filter({ hasText: 'Jurchen' }).click()
    await page.locator('.script-groups button').filter({ hasText: 'Variant forms' }).click()
    const jurVariant = page.locator('.parts-grid .part.vs').first()
    await jurVariant.waitFor()
    const jurTag = await jurVariant.getAttribute('data-vs')
    assert.match(jurTag ?? '', /^VS\d+$/)
    assert.equal(await jurVariant.locator('.part-vs').innerText(), jurTag)
    await jurVariant.hover()
    await panel.waitFor({ state: 'visible' })
    assert.equal(await panel.locator('.vs-pill').innerText(), jurTag)
    await page.keyboard.press('Escape')

    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${scheme}: VS markers, badges, hover details, and selector across views`)
  }

  // Mobile 390px check (light & dark)
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme })
    const mobileErrors = []
    mobile.on('pageerror', error => mobileErrors.push(error.message))
    await mobile.goto(`${url}/?lang=en&ids=${encodeURIComponent(`⿰氵${DOTTED}`)}`, { waitUntil: 'domcontentloaded' })
    const mobileSpan = mobile.locator('.sequence-paint span.varied[data-vs="VS18"]')
    await mobileSpan.waitFor()
    const box = await mobileSpan.boundingBox()
    assert.ok(box)
    await mobile.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    const card = mobile.locator('.ids-character-info')
    await card.waitFor({ state: 'visible' })
    assert.equal(await card.locator('.vs-pill').innerText(), 'VS18')
    assert.ok(await card.evaluate(el => {
      const b = el.getBoundingClientRect()
      const vw = Math.min(innerWidth, visualViewport?.width ?? innerWidth)
      const vh = Math.min(innerHeight, visualViewport?.height ?? innerHeight)
      return b.left >= 0 && b.right <= vw + 1 && b.bottom <= vh + 1
    }), 'mobile hovercard fits visible viewport')
    if (shots) await mobile.screenshot({ path: join(shots, `vs-mobile-${scheme}.png`) })
    assert.deepEqual(mobileErrors, [])
    await mobile.close()
  }
  console.log('PASS mobile 390px (light & dark): VS marker and hovercard fit viewport')
} finally {
  await browser.close()
}
