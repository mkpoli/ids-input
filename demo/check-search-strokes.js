// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-search-strokes.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(new URL('/fixtures/search-strokes.html', process.env.IDS_URL ?? 'http://localhost:5173').href)
  const chars = () => page.$$eval('.ids-search-results .hit .char', nodes => nodes.map(node => node.textContent))
  await page.locator('.ids-search-results .hit').first().waitFor()
  assert.deepEqual(await chars(), ['木', '林', '森'])
  const strokes = page.locator('.ids-search-results .stroke-limit input')
  await strokes.fill('4')
  await page.waitForFunction(() => document.querySelectorAll('.ids-search-results .hit').length === 1)
  assert.deepEqual(await chars(), ['木'])
  await strokes.fill('8')
  await page.waitForFunction(() => [...document.querySelectorAll('.ids-search-results .hit .char')].some(node => node.textContent === '林'))
  assert.deepEqual(await chars(), ['林'])
  await strokes.fill('12')
  await page.waitForFunction(() => [...document.querySelectorAll('.ids-search-results .hit .char')].some(node => node.textContent === '森'))
  assert.deepEqual(await chars(), ['森'])
  await strokes.fill('5')
  await page.waitForFunction(() => document.querySelectorAll('.ids-search-results .hit').length === 0)
  assert.match(await page.locator('.ids-search-results .count').innerText(), /0 found/)
  await strokes.fill('')
  await page.waitForFunction(() => document.querySelectorAll('.ids-search-results .hit').length === 3)
  console.log('PASS the search panel narrows by stroke count')
} finally { await browser.close() }
