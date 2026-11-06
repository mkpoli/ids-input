// The font switch draws the description being built in each face, in place of the specimen "Aa";
// an empty description falls back to the specimen. Run against a devrun server:
//   IDS_URL=http://localhost:5186 bun demo/check-font-samples.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5186'}#⿰女口`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const choices = page.locator('.bar .font-choice')
  await choices.first().waitFor({ timeout: 120000 })

  /** The four faces' sample paths, in the switch's order. */
  const paths = () => choices.evaluateAll(buttons => buttons.map(button => button.querySelector('.aa svg path')?.getAttribute('d') ?? ''))
  // The switch is drawn in each face from its own export: four paths, at least two of them different.
  await page.waitForFunction(() => [...document.querySelectorAll('.bar .font-choice .aa')].every(aa => aa.querySelector('svg path')), null, { timeout: 120000 })
  const first = await paths()
  assert.equal(first.length, 4, 'the switch names four faces')
  assert.ok(first.every(Boolean), 'every face draws the description')
  assert.ok(new Set(first).size >= 2, 'the faces draw their own outlines, not one drawing four times')
  assert.equal(await page.locator('.bar .font-choice .aa .specimen').count(), 0, 'no specimen stands in while a drawing is shown')

  // A new description replaces every sample.
  await page.locator('.ids-field input').fill('⿱日生')
  await page.waitForFunction(before => [...document.querySelectorAll('.bar .font-choice .aa')].every((aa, index) => {
    const path = aa.querySelector('svg path')?.getAttribute('d') ?? ''
    return path && path !== before[index]
  }), first, { timeout: 120000 })

  // An empty description shows the specimen again.
  await page.locator('.ids-field input').fill('')
  await page.waitForFunction(() => [...document.querySelectorAll('.bar .font-choice .aa')].every(aa => aa.querySelector('svg') === null && aa.textContent.trim() === 'Aa'), null, { timeout: 30000 })
  assert.deepEqual(errors, [])
  console.log('PASS the font switch samples the description in each face')
} finally { await browser.close() }
