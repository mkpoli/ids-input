import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const out = process.env.IDS_SCOPE_SHOTS ?? '/tmp/ids-linear-scopes'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2, colorScheme })
    await page.route('https://glyphatlas.org/**', route => route.abort())
    await page.goto(process.env.IDS_URL ?? 'http://127.0.0.1:5198', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill(process.env.IDS_SCOPE_TEXT ?? '⿺辶⿳穴⿲月⿱⿲幺言幺⿲長馬長刂心')
    await field.press('Home')
    await field.press('Tab')
    await page.mouse.move(0, 0)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${out}/${process.env.IDS_SCOPE_STAGE ?? 'before'}-${colorScheme}.png` })
    await page.locator('.ids-field').screenshot({ path: `${out}/${process.env.IDS_SCOPE_STAGE ?? 'before'}-detail-${colorScheme}.png` })
    await page.close()
  }
} finally { await browser.close() }
