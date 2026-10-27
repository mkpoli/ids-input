// Run against a devrun server: IDS_URL, CHROMIUM_PATH, optional IDS_GONGCHE_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1080 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5183'}/?lang=en`, { waitUntil: 'domcontentloaded' })
    const panel = page.locator('.ids-parts[role=group]'), field = page.locator('.ids-field input')
    await panel.getByRole('tab', { name: 'Gongche', exact: true }).click()
    assert.equal(await panel.locator('button.part').count(), 31)
    assert.equal(await panel.locator('details[open]').count(), 0)
    for (const char of '生𪛗𪛘𪛙𪛚𪛛𪛜𪛝𢒼㲸｜『』') {
      await field.fill('⿰⬚工')
      await field.press('Home')
      const button = panel.locator(`button.part[data-character="${char}"]`)
      assert.ok((await button.getAttribute('title')).includes(`U+${char.codePointAt(0).toString(16).toUpperCase()}`))
      // Keyboard selection avoids conflating text selection with palette insertion.
      await button.focus(); await button.press('Enter')
      await page.waitForFunction(expected => document.querySelector('.ids-field input').value.includes(expected), char)
      assert.ok((await field.inputValue()).includes(char))
    }
    await panel.getByRole('tab', { name: 'Recent', exact: true }).click()
    assert.ok(await panel.locator('button.part[data-character="𪛗"]').count())
    await panel.getByRole('tab', { name: 'Gongche', exact: true }).click()
    const filter = panel.locator('input')
    await filter.fill('𪛙')
    assert.equal(await panel.locator('button.part').count(), 1)
    await filter.fill('')
    await page.evaluate(() => document.fonts.ready)
    const client = await page.context().newCDPSession(page)
    await client.send('DOM.enable'); await client.send('CSS.enable')
    const { root } = await client.send('DOM.getDocument')
    for (const char of '𢒼𪛗𪛘𪛙𪛚𪛛𪛜𪛝') {
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
    console.log(`${scheme}: all 13 additions insert literally; Recent, filter, code points and bundled fonts verified`)
  }
} finally { await browser.close() }
