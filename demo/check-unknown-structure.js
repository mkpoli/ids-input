// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-unknown-structure.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
  page.setDefaultTimeout(120000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await page.locator('.search-modes button').last().click()
  const panel = page.locator('.structural-search')
  await panel.waitFor()
  await page.locator('.modes button').last().click()
  assert.equal(await page.locator('.modes button').last().getAttribute('aria-pressed'), 'true')
  assert.match(await panel.locator('.help').innerText(), /Each part of the pattern/u)
  assert.equal(await panel.locator('.presets').count(), 0)
  assert.equal(await panel.locator('.pattern input').inputValue(), '木口')

  const input = panel.locator('.pattern input')
  /** @param {string} query */
  async function ask(query) {
    await input.fill(query)
    await page.waitForFunction(() => {
      const results = document.querySelector('.ids-search-results')
      const list = results?.querySelector('.hits')
      return results?.getAttribute('data-status') === 'ready' && list && !list.classList.contains('stale')
    })
  }
  /** @returns {Promise<{ char: string, sequence: string, marks: string[] }[]>} */
  const hits = (count = 6) => page.$$eval('.ids-search-results .hit', (nodes, limit) => nodes.slice(0, limit).map(node => ({
    char: node.querySelector('.char')?.textContent ?? '',
    sequence: node.querySelector('.seq')?.textContent ?? '',
    marks: [...node.querySelectorAll('.seq mark')].map(mark => mark.textContent ?? ''),
  })), count)

  await ask('木口')
  const loose = await hits()
  for (const char of ['呆', '杏', '束']) assert.ok(loose.some(hit => hit.char === char), `${char} missing from ${loose.map(hit => hit.char)}`)
  assert.ok(loose.some(hit => hit.marks.length === 2), 'both parts are marked in a hit')
  assert.match(await page.locator('.ids-search-results .count').innerText(), /\d[\d,]* found/u)
  assert.ok(await page.locator('.ids-search-results .result-actions button').isVisible())

  // A compound element is kept whole and found inside an opened component.
  await ask('⿰⿰木木口')
  const compound = await hits(20)
  assert.ok(compound.some(hit => hit.char === '啉'), `啉 missing from ${compound.map(hit => hit.char)}`)
  assert.ok(compound.some(hit => hit.sequence.includes('⿰木木')), 'the compound element is shown opened')

  await page.locator('.modes button').first().click()
  await panel.locator('.presets').waitFor()
  await input.fill('⿱A⿰AA')
  await page.waitForFunction(() => {
    const results = document.querySelector('.ids-search-results')
    const list = results?.querySelector('.hits')
    return results?.getAttribute('data-status') === 'ready' && list && !list.classList.contains('stale')
  })
  const exact = await hits(30)
  assert.ok(exact.some(hit => hit.char === '品'), `品 missing from ${exact.map(hit => hit.char)}`)
  assert.deepEqual(errors, [])
  console.log('PASS unknown-structure search finds the pattern parts in any arrangement')
} finally { await browser.close() }
