// The zi.tools link: an icon beside the code point button and a named link over the search, both
// carrying the current IDS as zi.tools' `seq`, and the named link standing in all three search
// modes. Run against a devrun server:
//   IDS_URL=http://localhost:5341 CHROMIUM_PATH=/path/to/chrome bun demo/check-zitools-links.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const sequence = '⿱⿲⿱日月⿱⿲糸言糸⿲長馬長⿱干戈心'
  const href = `https://zi.tools/zi/?secondary=ids&seq=${encodeURIComponent(sequence)}`
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=ja`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const field = page.locator('.ids-field input').first()
  await field.waitFor({ timeout: 60000 })
  await field.fill(sequence)
  await page.keyboard.press('Tab')
  const icon = page.locator('.points-link')
  await icon.waitFor()
  assert.equal(await icon.getAttribute('href'), href, 'the icon opens the current IDS')
  assert.equal(await icon.getAttribute('target'), '_blank', 'and leaves the workshop')
  assert.equal(await icon.getAttribute('aria-label'), '字統網')
  assert.equal(await icon.getAttribute('title'), '字統網')

  const modes = ['この構成を持つ字', '部品を調べる', '構造検索']
  for (const mode of modes) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    const link = page.locator('.search-site')
    await link.waitFor()
    assert.equal(await link.getAttribute('href'), href, `${mode} offers the current IDS on zi.tools`)
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.match(await link.innerText(), /^字統網 ?↗$/u, 'the link names the site and marks it external')
  }
  assert.deepEqual(errors, [])
  console.log('PASS zi.tools links carry the current IDS from the input and all three searches')
} finally { await browser.close() }
