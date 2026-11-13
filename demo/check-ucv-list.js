// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-ucv-list.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'UCV', exact: true }).click()
  const panel = page.locator('.ids-pick-panel:not([hidden])')
  await panel.locator('.ids-ucv-entry').first().waitFor()
  assert.equal(await panel.locator('.ids-ucv-entry').first().getAttribute('data-entry'), '1')

  // An entry number finds its entry, with its forms drawn and its criterion named.
  const search = panel.locator('.ids-ucv input[type="search"]')
  await search.fill('321')
  const entry = panel.locator('.ids-ucv-entry[data-entry="321"]')
  await entry.waitFor()
  assert.equal(await panel.locator('.ids-ucv-entry').count(), 1)
  assert.equal(await entry.locator('.ids-ucv-form svg path').count(), 3)
  assert.match(await entry.locator('.ids-ucv-head').innerText(), /JIS 148/)
  assert.deepEqual(await entry.locator('.ids-ucv-char').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-character'))),
    ['爂', '爨', '釁', '爨', '\u{2F920}', '𦦝', '𦦧', '𦦞', '𦦡'])

  // An entry the source gives the same glyph twice still draws every form.
  await search.fill('213a')
  await panel.locator('.ids-ucv-entry[data-entry="213a"]').waitFor()
  assert.equal(await panel.locator('.ids-ucv-entry[data-entry="213a"] .ids-ucv-form').count(), 13)

  // A character finds the entries it is a form of first.
  await search.fill('壬')
  await panel.locator('.ids-ucv-entry[data-entry="1"]').waitFor()
  assert.equal(await panel.locator('.ids-ucv-entry').first().getAttribute('data-entry'), '1')

  // The non-unifiable list alone.
  await search.fill('')
  await panel.getByRole('button', { name: 'NUCV', exact: true }).click()
  await panel.locator('.ids-ucv-entry[data-entry="264a"]').waitFor()
  assert.equal(await panel.locator('.ids-ucv-entry').count(), 14)
  await panel.getByRole('button', { name: 'All', exact: true }).click()

  // A form that is a character goes into the description.
  await search.fill('1')
  await panel.locator('.ids-ucv-entry[data-entry="1"] button.ids-ucv-form[data-form="u738b"]').click()
  await page.waitForFunction(() => document.querySelector('#input-panel .ids-sequence, #input-panel')?.textContent?.includes('王') && !document.querySelector('.ids-pick-panel:not([hidden])')?.closest('#input-panel')?.querySelector('.ids-seq-none'))
  console.log('PASS the UCV tab lists, finds and applies component variations')
} finally { await browser.close() }
