// The output shows the component count and stroke total beside the code points: the character's
// recorded count when it has one, else its components added up. An empty slot or an unrecorded
// component leaves the total off.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const url = new URL(process.env.IDS_URL ?? 'http://localhost:5264')
  url.searchParams.set('lang', 'en')
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  const meta = page.locator('#output-panel .ids-preview-meta')
  const counts = meta.locator('.component-counts')
  const waitForCount = (want) => page.waitForFunction(text => (document.querySelector('#output-panel .ids-preview-meta')?.textContent ?? '').includes(text), want, { timeout: 30000 })
  const said = async () => (await meta.innerText()).replace(/\s+/g, ' ').trim()

  await field.fill('⿰木木')
  await waitForCount('8 strokes')
  assert.match(await said(), /U\+6797 · 2 components · 8 strokes/, 'the encoded character keeps its code point and shows 2 components with its recorded 8 strokes')
  assert.equal(await counts.getAttribute('title'), "The character's recorded stroke count.", 'an encoded character says its count is recorded')

  await field.fill('⿱木⿰木木')
  await waitForCount('12 strokes')
  assert.match(await said(), /3 components · 12 strokes/, 'three 木 add 12 strokes')

  await field.fill('⿰亻建')
  await waitForCount('10 strokes')
  assert.match(await said(), /2 components · 10 strokes/, 'an encoded character takes its recorded count, not the components’ 11')
  assert.doesNotMatch(await said(), /≈/, 'a recorded count is not marked approximate')

  await field.fill('⿰木龘')
  await waitForCount('52 strokes')
  assert.match(await said(), /2 components · ≈ 52 strokes/, 'an unencoded description adds its components up')
  assert.equal(await counts.getAttribute('title'), 'The strokes of its components.', 'the sum says what it adds up')

  await field.fill('⿰木\u{E0100}木')
  await waitForCount('8 strokes')
  assert.match(await said(), /2 components · .*8 strokes/, 'a variation selector does not hide the component’s count')

  await field.fill('⿰木X')
  await page.waitForFunction(() => {
    const text = document.querySelector('#output-panel .ids-preview-meta')?.textContent ?? ''
    return text.includes('2 components') && !text.includes('stroke')
  }, null, { timeout: 30000 })
  assert.equal(await counts.getAttribute('title'), null, 'a component count without a total needs no method note')
  assert.equal(await counts.locator('.strokes-sep').count(), 0, 'the component count stands without a total')

  await field.fill('⿰木⬚')
  await page.waitForTimeout(500)
  assert.equal(await counts.count(), 0, 'an empty slot leaves the count and total unknown')

  await field.fill('⿰木？')
  await page.waitForTimeout(500)
  assert.equal(await counts.count(), 0, 'an unknown part leaves the total unknown')

  assert.deepEqual(errors, [])
  console.log('PASS output strokes: recorded counts for encoded characters, component sums when none, variation selectors ignored, no total while a slot or an unknown part remains')
} finally { await browser.close() }
