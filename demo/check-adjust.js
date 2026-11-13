// Run against a local devrun server with IDS_URL and optional IDS_ADJUST_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync, readFileSync } from 'node:fs'
/**
 * The chosen part as the canvas shows it, read from its selection box: the turn of its top edge in
 * degrees, the cosine between its top and left edges (0 for a box that is turned and not sheared),
 * and its width relative to `width`.
 * @param {import('playwright-core').Page} page @param {number} [width]
 */
async function chained(page, width) {
  const quad = await page.locator('.ids-preview-large .select-box').getAttribute('points')
  const [p0, p1, , p3] = (quad ?? '').trim().split(' ').reduce((pairs, value, index, all) => index % 2 ? pairs : [...pairs, [Number(value), Number(all[index + 1])]], /** @type {number[][]} */ ([]))
  const top = [p1[0] - p0[0], p1[1] - p0[1]], left = [p3[0] - p0[0], p3[1] - p0[1]]
  const size = Math.hypot(...top)
  return { size, scale: width ? size / width : 1, degrees: Math.atan2(top[1], top[0]) * 180 / Math.PI, shear: (top[0] * left[0] + top[1] * left[1]) / (size * Math.hypot(...left)) }
}
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
    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('img').waitFor({ timeout: 30000 })
    await dialog.getByRole('treeitem').nth(1).click()
    await dialog.getByRole('button', { name: 'Edit on canvas', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.locator('.ids-preview .handle.resize').first().waitFor({ timeout: 10000 })
    const surface = await page.locator('.ids-preview-large svg[role="application"]').boundingBox()
    assert.ok(surface, 'the main preview has a drawing box')
    // The chosen component fills the left half; its middle is clear of the eight handles.
    const grip = { x: surface.x + surface.width * 0.25, y: surface.y + surface.height * 0.5 }
    await page.mouse.move(grip.x, grip.y)
    await page.mouse.down()
    await page.mouse.move(grip.x + 60, grip.y + 10)
    await page.mouse.up()
    await page.waitForTimeout(500)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document)
    const matrix = stored?.root?.children?.[0]?.transform?.[0]?.matrix
    assert.ok(Math.abs(matrix?.[4] ?? 0) > 1 || Math.abs(matrix?.[5] ?? 0) > 1, 'the main preview drag writes a document transform')
    assert.ok(new URL(page.url()).searchParams.has('doc'), 'the address bar carries the transformed document')
    await page.getByRole('menuitem', { name: 'File', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Export', exact: true }).click()
    const svgItem = page.getByRole('menuitem', { name: 'SVG', exact: true })
    await svgItem.waitFor({ timeout: 5000 })
    assert.equal(await svgItem.isDisabled(), false, 'the File export is enabled with a scoped drawing')
    await page.keyboard.press('Escape')
    const linked = await browser.newContext({ colorScheme: scheme })
    const restoredPage = await linked.newPage()
    // Static test servers do not rewrite sequence paths to index.html; move the same sequence to
    // the supported ?ids= form so this checks document restore rather than server routing.
    const shared = new URL(page.url())
    const portable = new URL(shared.origin)
    portable.search = shared.search
    const text = decodeURIComponent(shared.pathname.replace(/^\/|\/$/g, ''))
    if (text) portable.searchParams.set('ids', text)
    else portable.hash = shared.hash
    await restoredPage.goto(portable.href, { waitUntil: 'domcontentloaded' })
    await restoredPage.waitForTimeout(800)
    assert.ok(new URL(restoredPage.url()).searchParams.has('doc'), 'opening a document link keeps its token')
    const restoredTransform = await restoredPage.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.ok(restoredTransform?.[0]?.matrix, 'opening a document link restores the transform')
    await linked.close()
    await page.locator('button[aria-label^="Undo"]').first().click()
    await page.waitForTimeout(300)
    const undone = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.equal(undone, undefined, 'the toolbar undo reverts the layer transform')
    assert.ok(!new URL(page.url()).searchParams.has('doc'), 'the address bar drops the document token after undo')
    await page.locator('button[aria-label^="Redo"]').first().click()
    await page.waitForTimeout(300)
    const redone = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.ok(redone?.[0]?.matrix, 'the toolbar redo restores the layer transform')
    assert.ok(new URL(page.url()).searchParams.has('doc'), 'the address bar restores the document token after redo')
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
    const shortcut = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.equal(shortcut, undefined, 'the undo shortcut reverts the layer transform')
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(300)
    if (process.env.IDS_ADJUST_SHOTS) {
      mkdirSync(process.env.IDS_ADJUST_SHOTS, { recursive: true })
      await page.locator('.ids-preview').screenshot({ path: `${process.env.IDS_ADJUST_SHOTS}/adjust-${scheme}.png` })
    }
    // Export the scoped drawing, not the old merged drawing; the default PNG is not what this reads.
    await page.getByRole('radio', { name: 'SVG', exact: true }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Save SVG/i }).click()
    const download = await downloadPromise
    const path = await download.path()
    assert.ok(path, 'the SVG downloaded')
    const svg = readFileSync(path, 'utf8')
    assert.ok(svg.startsWith('<svg '), 'the export is an SVG')
    assert.ok(svg.includes('<path'), 'the export contains the scoped ink')
    await page.getByRole('button', { name: 'Reset part', exact: true }).click()
    await page.waitForTimeout(300)
    const reset = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.equal(reset, undefined)
    await page.locator('.ids-preview-large svg').focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    const nudged = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.ok(nudged?.[0]?.matrix, 'an arrow key nudges the layer')
    await page.keyboard.press('0')
    await page.waitForTimeout(300)
    const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document?.document?.root?.children?.[0]?.transform)
    assert.equal(cleared, undefined, 'zero clears the layer transform')
    await page.keyboard.press('0')
    await page.waitForTimeout(300)
    const { size: width } = await chained(page)
    await page.keyboard.press('=')
    await page.waitForTimeout(300)
    const grown = await chained(page, width)
    assert.ok(Math.abs(grown.scale - 1.05) < 1e-3 && Math.abs(grown.degrees) < 0.05, '= scales the part up by 5%, without turning it')
    await page.keyboard.press('-')
    await page.keyboard.press('-')
    await page.waitForTimeout(300)
    assert.ok(Math.abs((await chained(page, width)).scale - 1 / 1.05) < 1e-3, '- scales the part down by the same step')
    await page.keyboard.press('0')
    await page.keyboard.press(']')
    await page.keyboard.press('Shift+]')
    await page.waitForTimeout(300)
    const turned = await chained(page, width)
    assert.ok(Math.abs(turned.degrees - 20) < 0.05, `] turns 5°, Shift+] 15° more (got ${turned.degrees}°)`)
    assert.ok(Math.abs(turned.shear) < 1e-3 && Math.abs(turned.scale - 1) < 1e-3, `a key turn keeps the part's shape (shear ${turned.shear})`)
    await page.keyboard.press('[')
    await page.waitForTimeout(300)
    assert.ok(Math.abs((await chained(page)).degrees - 15) < 0.05, '[ turns back 5°')
    await page.keyboard.press('0')
    await page.waitForTimeout(300)
    // The rotate handle, dragged a quarter turn round the layer with Shift, lands on a 15° step.
    const knob = await page.locator('.ids-preview .handle.rotate .handle-hit').boundingBox()
    assert.ok(knob, 'the chosen layer shows its rotate handle')
    const pivot = { x: surface.x + surface.width * 0.25, y: surface.y + surface.height * 0.5 }
    const from = { x: knob.x + knob.width / 2, y: knob.y + knob.height / 2 }
    const radius = Math.hypot(from.x - pivot.x, from.y - pivot.y)
    const start = Math.atan2(from.y - pivot.y, from.x - pivot.x)
    await page.keyboard.down('Shift')
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let step = 1; step <= 8; step++) {
      const angle = start + step * (Math.PI / 2 + 0.12) / 8
      await page.mouse.move(pivot.x + radius * Math.cos(angle), pivot.y + radius * Math.sin(angle))
    }
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(300)
    const snapped = await chained(page)
    assert.ok(Math.abs(snapped.degrees) > 30, 'dragging the rotate handle turns the part')
    assert.ok(Math.abs(snapped.degrees / 15 - Math.round(snapped.degrees / 15)) < 0.01, `Shift snaps the turn to 15° (got ${snapped.degrees}°)`)
    assert.ok(Math.abs(snapped.shear) < 1e-3, 'the handle turn keeps the part\'s shape')
    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: main preview drag, scoped export and reset`)
    await page.close()
  }
} finally {
  await browser.close()
}
