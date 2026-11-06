// Run against a devrun server: IDS_URL, CHROMIUM_PATH, optional IDS_INFO_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5194'}/?lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.locator('.parts-tabs [role="tab"]').filter({ hasText: 'Tangut' }).click()
    await page.locator('.parts-filter').fill('𗀀')
    const tile = page.locator('.part[data-character="𗀀"]').first()
    await tile.locator('.part-text').hover()
    const panel = page.locator('.ids-character-info')
    await panel.waitFor({ state: 'visible' })
    await panel.getByText('Li Fanwen 2008', { exact: true }).waitFor()
    const text = await panel.innerText()
    assert.match(text, /poison; venom; toxin/, 'the English meanings')
    assert.match(text, /毒。/, 'the Japanese meaning')
    assert.match(text, /下毒者/, 'the Chinese meaning')
    assert.match(text, /Sound gloss, Li Fanwen/, 'the sound gloss')
    assert.match(text, /舌頭音/, 'the gloss text')
    assert.equal(await panel.locator('.meanings dt').allInnerTexts().then(rows => rows.join(',')), 'English,Japanese,Chinese')
    assert.equal(await panel.locator('.readings dt').count(), 10, 'eight reconstructions and two sound glosses')
    assert.match(await panel.getByText('Sound gloss, Nie Lishan', { exact: true }).locator('..').innerText(), /諾/)
    assert.deepEqual(errors, [])
    if (process.env.IDS_INFO_SHOTS) {
      mkdirSync(process.env.IDS_INFO_SHOTS, { recursive: true })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `${process.env.IDS_INFO_SHOTS}/after-tangut-meanings-${scheme}.png`, clip: { x: 0, y: 0, width: 1100, height: 1000 } })
    }
    await page.close()
  }
  console.log('PASS Tangut information: three languages, eight reconstructions and two sound glosses')
} finally { await browser.close() }
