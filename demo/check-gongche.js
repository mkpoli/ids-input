// Run against a devrun server: IDS_URL, CHROMIUM_PATH, optional IDS_GONGCHE_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
import { GONGCHE_PARTS } from '../src/core/gongche.js'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1080 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5183'}/?lang=en`, { waitUntil: 'domcontentloaded' })
    const panel = page.locator('.ids-parts[role=group]'), field = page.locator('.ids-field input')
    await panel.getByRole('tab', { name: 'Gongche', exact: true }).click()
    assert.equal(await panel.locator('button.part').count(), GONGCHE_PARTS.length)
    assert.equal(await panel.locator('details[open]').count(), 0)
    for (const { part: char } of GONGCHE_PARTS) {
      await field.focus()
      await field.press('ControlOrMeta+A')
      await field.press('Backspace')
      await field.fill('⿰⬚工')
      await page.locator('.ids-tree .ids-part.empty').click()
      const button = panel.locator(`button.part[data-character="${char}"]`)
      if ([...char].length === 1) assert.ok((await button.getAttribute('title')).includes(`U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`))
      // Keyboard selection avoids conflating text selection with palette insertion.
      await button.focus(); await button.press('Enter')
      await page.waitForFunction(expected => document.querySelector('.ids-field input').value === expected, `⿰${char}工`)
      assert.equal(await field.inputValue(), `⿰${char}工`)
    }
    await panel.getByRole('tab', { name: 'Recent', exact: true }).click()
    assert.ok(await panel.locator('button.part[data-character="*"]').count())
    await panel.getByRole('tab', { name: 'Gongche', exact: true }).click()
    const filter = panel.locator('input')
    await filter.fill('𪛙')
    assert.equal(await panel.locator('button.part').count(), 1)
    await filter.fill('⿰彳上')
    assert.equal(await panel.locator('button.part').count(), 1)
    assert.equal(await panel.locator('button.part').getAttribute('data-character'), '𱝫')
    await filter.fill('')
    await page.evaluate(() => document.fonts.ready)
    const client = await page.context().newCDPSession(page)
    await client.send('DOM.enable'); await client.send('CSS.enable')
    const { root } = await client.send('DOM.getDocument')
    for (const { part: char } of GONGCHE_PARTS.filter(p => [...p.part].length === 1 && p.part.codePointAt(0) > 0xFFFF)) {
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: `.ids-parts button[data-character="${char}"] .part-text` })
      const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId })
      assert.ok(fonts.some(font => font.isCustomFont && font.glyphCount > 0), `Bundled font: ${char}`)
    }
    if (process.env.IDS_GONGCHE_SHOTS) {
      mkdirSync(process.env.IDS_GONGCHE_SHOTS, { recursive: true })
      await panel.screenshot({ path: `${process.env.IDS_GONGCHE_SHOTS}/after-${scheme}.png` })
    }
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`${scheme}: all ${GONGCHE_PARTS.length} entries insert literally; Recent, filter, code points and bundled fonts verified`)
  }
} finally { await browser.close() }
