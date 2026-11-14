// Run against a local devrun server with IDS_URL. Each page's title opens the workshop and every
// other page, keeps the language of a translated page, and ticks the page it is on. IDS_PAGE_SHOTS saves the open menu.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const base = process.env.IDS_URL ?? 'http://localhost:5186'
const shots = process.env.IDS_PAGE_SHOTS
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const id of ['sources', 'unencoded', 'ucv', 'normalization', 'open-data', 'compare', 'engines']) {
      await page.goto(`${base}/${id}.html?lang=ja`, { waitUntil: 'domcontentloaded' })
      const trigger = page.locator('h1 button[aria-haspopup="menu"]')
      await trigger.click()
      const menu = page.getByRole('menu')
      const items = menu.getByRole('menuitem')
      assert.equal(await items.count(), 9, `${id}: the workshop and eight pages`)
      const english = id === 'open-data' || id === 'engines'
      assert.equal(await menu.locator('[aria-current="page"]').getAttribute('href'), `./${id}.html${english ? '' : '?lang=ja'}`, `${id}: its own row is ticked`)
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-current')), 'page', `${id}: opening focuses the current row`)
      if (shots && (id === 'ucv' || id === 'engines')) {
        await page.waitForTimeout(300)
        await page.screenshot({ path: `${shots}/${id}-${scheme}.png`, clip: { x: 0, y: 0, width: 640, height: 420 } })
      }
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('menu').count(), 0, `${id}: Escape closes`)
    }
    await page.goto(`${base}/ucv.html?lang=ja`, { waitUntil: 'domcontentloaded' })
    await page.locator('h1 button').click()
    await page.getByRole('menu').getByRole('menuitem', { name: '正規化' }).click()
    await page.waitForURL(/normalization\.html\?lang=ja$/)
    await page.locator('h1 button').click()
    await page.getByRole('menu').getByRole('menuitem').first().click()
    await page.waitForURL(url => url.pathname === '/' && url.search === '?lang=ja')
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('page select: ok')
} finally {
  await browser.close()
}
