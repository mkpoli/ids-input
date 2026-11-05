// The selection follows the painted bounds, not the composer's layout cell. In ⿳士⿲女口意祥 the
// 意 paints well past its cell, so its box must still surround the glyph.
// Run against a local dev server, with IDS_URL set.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill('⿳士⿲女口意祥')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: 'Adjust layout', exact: true }).click()
    const svg = page.locator('.ids-preview-large svg[role="application"]')
    await svg.waitFor({ state: 'visible', timeout: 60000 })
    await page.waitForTimeout(500)
    const surface = await svg.boundingBox()
    assert.ok(surface, 'the preview has a drawing box')
    await page.mouse.click(surface.x + surface.width * 0.78, surface.y + surface.height * 0.55)
    await page.waitForTimeout(400)
    const chosen = await page.evaluate(() => {
      const record = JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document
      const found = node => {
        if (!node) return null
        if (node.id === record?.chosen) return node
        if (node.children) for (const child of node.children) { const hit = found(child); if (hit) return hit }
        return node.child ? found(node.child) : null
      }
      return found(record?.document?.root)?.char ?? null
    })
    assert.equal(chosen, '意', 'the click chooses 意')

    const measured = await page.evaluate(() => {
      const record = JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0].document
      const svg = window.document.querySelector('.ids-preview-large svg[role="application"]')
      const group = svg?.querySelector(`[data-layer="${record.chosen}"]`)
      const grip = svg?.querySelector('.select-box')
      if (!svg || !group || !grip) return null
      const box = svg.getBoundingClientRect()
      const numbers = (grip.getAttribute('points') ?? '').split(/[ ,]+/).map(Number)
      const xs = numbers.filter((_, index) => index % 2 === 0), ys = numbers.filter((_, index) => index % 2 === 1)
      const quad = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
      const ink = group.getBoundingClientRect()
      const painted = {
        left: (ink.left - box.left) / box.width * 1000,
        top: (ink.top - box.top) / box.height * 1000,
        right: (ink.right - box.left) / box.width * 1000,
        bottom: (ink.bottom - box.top) / box.height * 1000,
      }
      return { quad, painted }
    })
    assert.ok(measured, 'the selection and the painted part are both in the drawing')
    for (const edge of ['left', 'top', 'right', 'bottom']) {
      assert.ok(Math.abs(measured.quad[edge] - measured.painted[edge]) < 12, `the selection ${edge} follows the painted bound (${measured.quad[edge].toFixed(1)} vs ${measured.painted[edge].toFixed(1)})`)
    }
    assert.equal(await page.locator('.handle.resize').count(), 8, 'the eight resize handles stand on the painted box')
    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: the selection hugs 意's painted bounds, not its layout cell`)
    await page.close()
  }
} finally {
  await browser.close()
}
