// Run against a devrun server: IDS_URL=http://localhost:5186 bun demo/check-search-pages.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(120000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://glyphatlas.org/**', route => route.abort())

  // 1. Workshop IDS search with 4,700+ hits (𦉪) in zh-Hans: pages and stroke filtering beyond 600 hits.
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5186'}/?lang=zh-Hans`, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.fill('𦉪')
  const main = page.locator('.results > .ids-search-results')
  const mainHits = main.locator('.hit .char')
  await mainHits.first().waitFor()
  await page.waitForFunction(() => document.querySelector('.results > .ids-search-results')?.getAttribute('data-status') === 'ready')

  const countText = await main.locator('.count').innerText()
  const total = Number(countText.replace(/[^\d]/g, ''))
  assert.ok(total >= 4710, `expected >= 4710 hits for 𦉪, got ${countText}`)
  const expectedPages = Math.ceil(total / 60)
  assert.equal(await mainHits.count(), 60)
  assert.equal(await main.locator('.pages').count(), 2, 'top and bottom pagers shown for 60-item pages')
  const topPager = main.locator('.pages').first()
  assert.match(await topPager.innerText(), new RegExp(`第 1 / ${expectedPages} 页`))

  const page1First = await mainHits.first().textContent()
  const page1Seq = await main.locator('.hit .seq').first().textContent()
  assert.ok(page1Seq?.includes('𦉪'), `expected Page 1 first hit sequence to contain literal 𦉪, got ${page1Seq}`)
  await main.locator('.pages').last().getByRole('button', { name: '下一页', exact: true }).click()
  await page.waitForFunction(expected => document.querySelector('.results > .ids-search-results')?.getAttribute('data-status') === 'ready'
    && document.querySelector('.results > .ids-search-results .pages span')?.textContent?.includes(expected),
    `第 2 / ${expectedPages} 页`)
  assert.equal(await mainHits.count(), 60)
  const page2First = await mainHits.first().textContent()
  assert.notEqual(page2First, page1First, 'page 2 starts with a different character')

  await topPager.getByRole('button', { name: '上一页', exact: true }).click()
  await page.waitForFunction(expected => document.querySelector('.results > .ids-search-results .pages span')?.textContent?.includes(expected),
    `第 1 / ${expectedPages} 页`)
  assert.equal(await mainHits.first().textContent(), page1First)

  // Jump straight to the last page via the page number field.
  const pageInput = topPager.locator('input[type="number"]')
  await pageInput.fill(String(expectedPages))
  await pageInput.press('Enter')
  await page.waitForFunction(expected => document.querySelector('.results > .ids-search-results')?.getAttribute('data-status') === 'ready'
    && document.querySelector('.results > .ids-search-results .pages span')?.textContent?.includes(expected),
    `第 ${expectedPages} / ${expectedPages} 页`)
  assert.equal(await mainHits.count(), total % 60 || 60)
  assert.equal(await topPager.getByRole('button', { name: '下一页', exact: true }).isDisabled(), true)

  // Stroke filter searches all hits (none of the 15 29-stroke 𦉪 hits sit in the first 600).
  const strokes = main.locator('.stroke-limit input')
  await strokes.fill('29')
  await page.waitForFunction(() => {
    const el = document.querySelector('.results > .ids-search-results')
    return el?.getAttribute('data-status') === 'ready' && el.querySelectorAll('.hit').length === 15
  })
  assert.equal(await main.locator('.pages').count(), 0, 'single-page filtered results hide the pager')
  assert.match(await main.locator('.count').innerText(), /15个/)

  // A stroke count with multiple pages (16 strokes: >400 hits) is also paged.
  await strokes.fill('16')
  await page.waitForFunction(() => {
    const el = document.querySelector('.results > .ids-search-results')
    return el?.getAttribute('data-status') === 'ready' && el.querySelectorAll('.hit').length === 60
  })
  assert.ok(await main.locator('.pages').count() >= 1)
  const strokePage1First = await mainHits.first().textContent()
  await main.locator('.pages').first().getByRole('button', { name: '下一页', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.results > .ids-search-results .pages span')?.textContent?.includes('第 2 /'))
  assert.notEqual(await mainHits.first().textContent(), strokePage1First)

  await strokes.fill('')
  await page.waitForFunction(expected => document.querySelector('.results > .ids-search-results')?.getAttribute('data-status') === 'ready'
    && document.querySelector('.results > .ids-search-results .pages span')?.textContent?.includes(expected),
    `第 1 / ${expectedPages} 页`)

  // 2. Similar structures (limit=12) also paginate cleanly with a single top pager.
  await field.fill('⿱雨林')
  const similar = page.locator('.similar .ids-search-results')
  await similar.locator('.hit .char').first().waitFor()
  await page.waitForFunction(() => document.querySelector('.similar .ids-search-results')?.getAttribute('data-status') === 'ready')
  assert.equal(await similar.locator('.pages').count(), 1, '12-item similar pages show one top pager')
  const similar1First = await similar.locator('.hit .char').first().textContent()
  await similar.locator('.pages').getByRole('button', { name: '下一页', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.similar .ids-search-results')?.getAttribute('data-status') === 'ready'
    && document.querySelector('.similar .ids-search-results .pages span')?.textContent?.includes('第 2 /'))
  assert.notEqual(await similar.locator('.hit .char').first().textContent(), similar1First)

  // 3. Structural search (unknown mode) also pages cleanly.
  await page.locator('.search-modes button').last().click()
  await page.locator('.structural-search .modes button').last().click()
  const structural = page.locator('.structural-search .ids-search-results')
  await structural.locator('.hit .char').first().waitFor()
  await page.waitForFunction(() => document.querySelector('.structural-search .ids-search-results')?.getAttribute('data-status') === 'ready')
  const struct1First = await structural.locator('.hit .char').first().textContent()
  await structural.locator('.pages').first().getByRole('button', { name: '下一页', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.structural-search .ids-search-results')?.getAttribute('data-status') === 'ready'
    && document.querySelector('.structural-search .ids-search-results .pages span')?.textContent?.includes('第 2 /'))
  assert.notEqual(await structural.locator('.hit .char').first().textContent(), struct1First)

  assert.deepEqual(errors, [])
  console.log('PASS all search modes paginate across pages and stroke filters search all hits')
} finally { await browser.close() }
