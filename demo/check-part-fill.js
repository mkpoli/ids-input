// Run against a local devrun server with IDS_URL. Checks the per-part fill in the output: a component
// without one follows the ink, a chosen one keeps its alpha in the preview, the document and the
// exported SVG, and Use text colour takes it back.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync, readFileSync } from 'node:fs'
import { readSvgDocument } from './lib/documents.js'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill('⿰木口')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 60000 })

    const section = page.locator('section.part-fills')
    assert.equal(await section.locator('li').count(), 2, 'one row per component')
    assert.deepEqual(await section.locator('.value').allTextContents(), ['Text colour', 'Text colour'], 'both inherit the ink')

    await section.getByRole('button', { name: 'Fill of 木' }).click()
    const dialog = page.getByRole('dialog', { name: 'Fill' })
    await dialog.waitFor()
    await dialog.getByLabel('Hex colour').fill('#B42318')
    await dialog.getByLabel('Hex colour').press('Enter')
    await dialog.getByLabel('Alpha (%)', { exact: true }).fill('50')
    await dialog.getByLabel('Alpha (%)', { exact: true }).press('Enter')
    await page.waitForTimeout(150)
    assert.deepEqual(await section.locator('.value').allTextContents(), ['#B4231880', 'Text colour'], 'the row carries the fill and its alpha')
    const fills = await page.locator('.ids-preview svg path').evaluateAll(paths => paths.map(path => path.getAttribute('fill')))
    assert.ok(fills.includes('#b42318'), 'the preview paints the filled component')
    assert.ok(await page.locator('.ids-preview svg g[opacity="0.502"]').count() >= 1, 'the fill is composited at half opacity')
    assert.ok(fills.includes('currentColor'), 'the other component keeps the ink')

    if (process.env.IDS_FILL_SHOTS) {
      mkdirSync(process.env.IDS_FILL_SHOTS, { recursive: true })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `${process.env.IDS_FILL_SHOTS}/picker-${scheme}.png` })
    }
    await dialog.getByRole('button', { name: 'Use text colour' }).click()
    await page.waitForTimeout(150)
    assert.deepEqual(await section.locator('.value').allTextContents(), ['Text colour', 'Text colour'], 'Use text colour clears the fill')
    assert.equal(await page.locator('.ids-preview svg path[fill="#b42318"]').count(), 0, 'the preview goes back to the ink')

    // Choose it again, reload, and read the file back after a save.
    await section.getByRole('button', { name: 'Fill of 木' }).click()
    await dialog.getByLabel('Hex colour').fill('#B4231880')
    await dialog.getByLabel('Hex colour').press('Enter')
    await page.keyboard.press('Escape')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 60000 })
    assert.equal(await page.locator('section.part-fills .value').first().textContent(), '#B4231880', 'the fill survives a reload')

    await page.getByRole('radio', { name: 'SVG', exact: true }).click()
    await page.getByRole('radio', { name: 'Transparent', exact: true }).click()
    const waiting = page.waitForEvent('download')
    await page.getByRole('button', { name: /Save SVG/i }).click()
    const path = await (await waiting).path()
    const svg = readFileSync(path, 'utf8')
    assert.ok(svg.includes('fill="#b42318"'), 'the exported SVG carries the fill')
    assert.ok(svg.includes('opacity="0.502"'), 'the exported SVG carries the alpha')
    const embedded = readSvgDocument(svg)
    assert.deepEqual(embedded.root.children[0].fill, { type: 'solid', colour: '#b4231880' }, 'the exported SVG carries the document fill')

    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${scheme}: inherit, solid fill with alpha, reset, reload, export`)
  }
} finally { await browser.close() }
