// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-stroke-order.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`, { waitUntil: 'networkidle' })
  const parts = page.locator('.ids-parts').first()
  const keys = parts.locator('.stroke-keys')
  const press = async letters => { for (const letter of letters) await keys.locator(`[data-stroke="${letter}"]`).click() }
  const shown = () => parts.locator('.parts-panel .part').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-character')))
  const headings = () => parts.locator('.parts-panel .parts-class').allInnerTexts()
  await keys.waitFor()
  assert.equal(await keys.locator('.stroke-typed').innerText(), 'Stroke order')

  // 彐 is written 折 横 横: it leads the parts of three strokes that begin so.
  await press('zhh')
  await parts.locator('.parts-panel .part[data-character="彐"]').waitFor()
  assert.equal(await keys.locator('.stroke-typed').innerText(), '㇕㇐㇐')
  assert.equal((await headings())[0], '3 strokes')
  assert.ok((await shown()).slice(0, 12).includes('彐'))
  assert.ok(!(await shown()).includes('王'))
  // No chip is pressed while the strokes decide what is listed.
  assert.equal(await parts.locator('.parts-counts button[aria-pressed="true"]').count(), 0)

  // A part written exactly as typed comes before the longer ones.
  await keys.locator('.stroke-clear').click()
  await press('hhsh')
  await parts.locator('.parts-panel .part[data-character="王"]').waitFor()
  assert.ok((await shown()).slice(0, 4).includes('王'))
  assert.equal((await headings())[0], '4 strokes')

  // Backspace takes one stroke off; either order of 乃 finds it.
  await keys.locator('.stroke-backspace').click()
  assert.equal(await keys.locator('.stroke-typed').innerText(), '㇐㇐㇑')
  await keys.locator('.stroke-clear').click()
  await press('pz')
  await parts.locator('.parts-panel .part[data-character="乃"]').waitFor()
  await keys.locator('.stroke-clear').click()
  await press('zp')
  await parts.locator('.parts-panel .part[data-character="乃"]').waitFor()

  // A key no part goes on with is off, keeps the focus and types nothing: no part begins 點 豎 豎.
  await keys.locator('.stroke-clear').click()
  await press('ns')
  const vertical = keys.locator('[data-stroke="s"]')
  assert.equal(await vertical.getAttribute('aria-disabled'), 'true')
  await vertical.focus()
  await vertical.click({ force: true })
  assert.equal(await keys.locator('.stroke-typed').innerText(), '㇔㇑')
  assert.ok(await vertical.evaluate(node => node === document.activeElement))

  // The filter narrows the parts the strokes are looked for in.
  await keys.locator('.stroke-clear').click()
  await parts.locator('.parts-filter').fill('王玉')
  await press('hh')
  await parts.locator('.parts-panel .part[data-character="王"]').waitFor()
  assert.deepEqual((await shown()).sort(), ['王', '玉'].sort())
  await parts.locator('.parts-filter').fill('')

  // Choosing a group leaves the stroke search.
  await parts.locator('.parts-counts button').first().click()
  assert.equal(await keys.locator('.stroke-typed').innerText(), 'Stroke order')
  assert.equal(await parts.locator('.parts-counts button[aria-pressed="true"]').count(), 1)

  // All characters takes the strokes too, over every Han character, and a stroke count narrows them.
  await parts.locator('.parts-counts button', { hasText: 'All characters' }).click()
  await parts.locator('.parts-panel .part').first().waitFor()
  await press('hhsh')
  await parts.locator('.parts-panel .part[data-character="王"]').waitFor()
  assert.ok((await shown()).slice(0, 12).includes('王'))
  assert.equal(await keys.locator('.stroke-typed').innerText(), '㇐㇐㇑㇐')
  // 珏 begins with 王's strokes and is not a palette component: nine strokes in all.
  await parts.locator('.parts-counts button', { hasText: /^9$/ }).click()
  await parts.locator('.parts-panel .part[data-character="珏"]').waitFor()
  assert.ok(!(await shown()).includes('王'))
  // Leaving the view leaves the stroke search.
  await parts.locator('.parts-counts button').first().click()
  assert.equal(await keys.locator('.stroke-typed').innerText(), 'Stroke order')

  // Strokes pressed before the palette has arrived are kept: the palette is held back a moment.
  const early = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  let held = 0
  await early.route(/ids-parts/, async route => { held++; await new Promise(done => setTimeout(done, 2500)); await route.continue() })
  await early.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`, { waitUntil: 'domcontentloaded' })
  const earlyKeys = early.locator('.ids-parts').first().locator('.stroke-keys')
  await earlyKeys.waitFor()
  for (const letter of 'zhh') await earlyKeys.locator(`[data-stroke="${letter}"]`).click()
  await early.locator('.ids-parts').first().locator('.parts-panel .part[data-character="彐"]').waitFor()
  assert.equal(await earlyKeys.locator('.stroke-typed').innerText(), '㇕㇐㇐')
  assert.ok(held > 0, 'the palette request was held back')
  console.log('PASS the stroke keys find a part by its stroke order')
} finally { await browser.close() }
