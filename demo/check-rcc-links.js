// Verify RCC R+XXXX codes and links across the workshop output, examples and font comparison.
// Run against a devrun server:
//   IDS_URL=http://localhost:4187 CHROMIUM_PATH=… bun demo/check-rcc-links.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:4187'
const shotDir = process.env.SHOT_DIR ?? ''

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  // Mock /api/match so the check is deterministic offline and tests live lookup for non-example sequences.
  const MOCK_RCC = {
    '⿱艹半': [{ id: 2097, ids: '⿱艹半', layout: null, cover_key: null }],
    '⿰魚岸': [{ id: 5, ids: '⿰魚岸', layout: null, cover_key: null }],
    '⿰彳ヱ': [{ id: 1, ids: '⿰彳ヱ', layout: null, cover_key: null }],
  }
  await page.route('https://rare.glyphatlas.org/api/match**', async route => {
    const reqUrl = new URL(route.request().url())
    const ids = reqUrl.searchParams.get('ids') ?? ''
    const body = MOCK_RCC[ids] ?? []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto(`${url}/?lang=en`, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.waitFor({ timeout: 20000 })
  await page.waitForFunction(() => (document.querySelector('.ids-preview-meta')?.textContent ?? '').trim().length > 0, null, { timeout: 20000 })

  const setSequence = async (/** @type {string} */ sequence) => {
    await field.fill(sequence)
    await field.dispatchEvent('input')
  }

  // 1. Unencoded example in RCC: ⿱艹半 -> R+0831 linking to /en/entry/2097
  await setSequence('⿱艹半')
  const rccLink = page.locator('.ids-preview-meta a.rcc-link')
  await rccLink.waitFor({ state: 'visible', timeout: 15000 })
  assert.equal((await rccLink.locator('code').textContent())?.trim(), 'R+0831', 'output shows R+0831 for ⿱艹半')
  assert.equal(await rccLink.getAttribute('href'), 'https://rare.glyphatlas.org/en/entry/2097', 'link points to RCC en entry 2097')
  await page.waitForFunction(() => document.querySelector('.ids-preview')?.dataset.step !== 'loading', null, { timeout: 30000 })
  await page.waitForTimeout(300)

  if (shotDir) {
    await page.locator('#output-panel').screenshot({ path: `${shotDir}/after-output-light.png` })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(200)
    await page.locator('#output-panel').screenshot({ path: `${shotDir}/after-output-dark.png` })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(200)
  }

  // 2. Unencoded character NOT in starter examples, resolved live from RCC: ⿰魚岸 -> R+0005
  await setSequence('⿰魚岸')
  await page.waitForFunction(() => document.querySelector('.ids-preview-meta a.rcc-link code')?.textContent?.trim() === 'R+0005', null, { timeout: 15000 })
  assert.equal(await rccLink.getAttribute('href'), 'https://rare.glyphatlas.org/en/entry/5', 'live RCC lookup links ⿰魚岸 to entry 5')

  // 3. Encoded Unicode character: ⿰木木 (林) -> U+6797 and no RCC link
  await setSequence('⿰木木')
  await page.waitForFunction(() => (document.querySelector('.ids-preview-meta')?.textContent ?? '').includes('U+6797'), null, { timeout: 15000 })
  await page.waitForTimeout(300)
  assert.equal(await rccLink.count(), 0, 'encoded character shows no RCC link')

  // 4. Visual substitute for an encoded Unicode character: ⿰彳ヱ -> 𭛝 U+2D6DD, no RCC link
  await setSequence('⿰彳ヱ')
  await page.waitForFunction(() => (document.querySelector('.ids-preview-meta')?.textContent ?? '').includes('U+2D6DD'), null, { timeout: 15000 })
  await page.waitForTimeout(300)
  assert.equal(await rccLink.count(), 0, 'substituted Unicode character shows no RCC link')

  // 5. Examples menu: cards & list show R+XXXX links and filter matches R+0831
  await page.getByTitle('Examples', { exact: true }).click()
  const menu = page.locator('.menu')
  await menu.waitFor()
  const banCard = menu.locator('.card', { hasText: '⿱艹半' }).first()
  await banCard.waitFor()
  const banLink = banCard.locator('a.note-link')
  assert.equal((await banLink.textContent())?.replace('↗', '').trim(), 'R+0831', 'examples card shows R+0831')
  assert.equal(await banLink.getAttribute('href'), 'https://rare.glyphatlas.org/en/entry/2097', 'examples card links to RCC entry')

  const shuaiCard = menu.locator('.card', { hasText: '⿱力十' }).first()
  assert.match(await shuaiCard.locator('.card-note').innerText(), /R\+083E.*率/, 'Erjian card pairs R+083E with standard 率')

  const pyeolCard = menu.locator('.card', { hasText: '⿱坪乙' }).first()
  assert.match(await pyeolCard.locator('.card-note').innerText(), /펼 · R\+07B5/, 'Korean card pairs reading 펼 with R+07B5')
  assert.match(await pyeolCard.locator('.card-hit').getAttribute('aria-label') ?? '', /펼.*R\+07B5/, 'linked card accessible label preserves reading')

  if (shotDir) {
    await menu.locator('.filter-input').fill('R+083')
    await page.waitForTimeout(250)
    await menu.screenshot({ path: `${shotDir}/after-examples-light.png` })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(200)
    await menu.screenshot({ path: `${shotDir}/after-examples-dark.png` })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(200)
  }

  // Filter by R+0831 narrows directly to ⿱艹半, keyboard navigation reaches the RCC link, and list view works too.
  await menu.locator('.filter-input').fill('R+0831')
  await page.waitForTimeout(200)
  assert.equal(await menu.locator('.card').count(), 1, 'filtering by R+0831 finds ⿱艹半')
  await menu.locator('.card .card-hit').first().focus()
  await page.keyboard.press('ArrowDown')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), 'https://rare.glyphatlas.org/en/entry/2097', 'ArrowDown moves focus to the RCC link in Menu')

  await menu.locator('.view', { hasText: 'List' }).click()
  await page.waitForTimeout(200)
  const banRow = menu.locator('.item-linked', { hasText: '⿱艹半' }).first()
  assert.equal(await banRow.locator('a.note-link').getAttribute('href'), 'https://rare.glyphatlas.org/en/entry/2097', 'list view links to RCC entry')
  await menu.locator('.view', { hasText: 'Cards' }).click()
  await page.waitForTimeout(200)

  await menu.locator('.card .card-hit').first().click()
  await page.waitForTimeout(300)
  assert.equal(await field.inputValue(), '⿱艹半', 'clicking linked card opens its sequence')

  // Starter dialog (MenuList): card & list views also show R+XXXX links and preserve readings.
  await page.getByTitle('Templates, examples and closed tabs', { exact: true }).click()
  const starter = page.getByRole('dialog', { name: 'Templates, examples and closed tabs' })
  await starter.waitFor()
  await starter.getByRole('tab', { name: 'Examples', exact: true }).click()
  await starter.locator('.filter-input').fill('R+07B5')
  await page.waitForTimeout(200)
  const starterPyeol = starter.locator('.card', { hasText: '⿱坪乙' }).first()
  assert.equal(await starterPyeol.locator('a.note-link').getAttribute('href'), 'https://rare.glyphatlas.org/en/entry/1973', 'starter card links to RCC entry')
  assert.match(await starterPyeol.locator('.card-hit').getAttribute('aria-label') ?? '', /펼.*R\+07B5/, 'starter card accessible label preserves reading')
  await page.keyboard.press('Escape')

  // 6. Localized RCC link in Japanese (?lang=ja)
  await page.goto(`${url}/?lang=ja#${encodeURIComponent('⿱艹半')}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview-meta a.rcc-link').waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(await page.locator('.ids-preview-meta a.rcc-link').getAttribute('href'), 'https://rare.glyphatlas.org/ja/entry/2097', 'Japanese locale links to /ja/entry/2097')

  // 7. Font comparison page: unencoded-db rows get R+XXXX links when unencoded, not when encoded
  await page.goto(`${url}/font-compare.html?lang=en`, { waitUntil: 'domcontentloaded' })
  const select = page.locator('select.ui-select')
  await select.waitFor()
  await select.selectOption('unencoded')
  await page.waitForTimeout(400)
  const row1 = page.locator('.table .row').nth(0)
  assert.equal(await row1.locator('a.rcc-link').count(), 0, 'encoded RCC row gets no R+ link in font compare')
  const row2 = page.locator('.table .row').nth(1)
  const row2Link = row2.locator('a.rcc-link')
  assert.equal((await row2Link.textContent())?.replace('↗', '').trim(), 'R+0002', 'unencoded RCC row shows R+0002')
  assert.equal(await row2Link.getAttribute('href'), 'https://rare.glyphatlas.org/en/entry/2', 'unencoded RCC row links to /en/entry/2')

  if (shotDir) {
    await page.locator('.table').screenshot({ path: `${shotDir}/after-font-compare-light.png` })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(200)
    await page.locator('.table').screenshot({ path: `${shotDir}/after-font-compare-dark.png` })
    await page.emulateMedia({ colorScheme: 'light' })
  }

  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`)
  console.log('PASS RCC R+XXXX codes and links work across workshop output, examples, and font compare')
} finally {
  await browser.close()
}
