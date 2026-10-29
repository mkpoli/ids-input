// Run against a local devrun server: IDS_URL=http://localhost:5186 bun demo/check-tagged-glyph.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

/** The ink paths the preview draws for a sequence typed into the field. A drawing is the `ink`
 *  path of the composed branch, or the paths inside the document group the layer view draws. */
async function drawing(page, sequence) {
  const field = page.locator('.ids-field input')
  const paths = () => page.locator('.ids-preview-large svg path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? '').filter(Boolean))
  await field.fill(sequence)
  await page.waitForFunction(() => !/Composing/.test(document.querySelector('.ids-preview-meta')?.textContent ?? ''))
  let last = '', ink = []
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(300)
    ink = await paths()
    const seen = JSON.stringify(ink)
    if (seen !== '[]' && seen === last) break
    last = seen
  }
  return { badge: (await page.locator('.ids-preview-meta').textContent())?.trim() ?? '', ink }
}

/** Paths as geometry: the two drawing sources write the same numbers with and without `.0`. */
const shape = ink => ink.map(d => d.replace(/-?\d*\.\d+/g, number => String(Number(number))))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const errors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  // ⿻[1:]丨日 names 甲, whose glyph is drawn instead of the approximate composition.
  const tagged = await drawing(page, '⿻[1:]丨日')
  assert.ok(!/Approximate/.test(tagged.badge), `still approximate: ${tagged.badge}`)
  const plain = await drawing(page, '甲')
  assert.deepEqual(shape(tagged.ink), shape(plain.ink), 'the tagged description draws 甲')
  // Every face draws it: the serif face keeps its own composer.
  await page.locator('.font-choice').nth(1).click()
  const serif = await drawing(page, '⿻[:-1]〢日')
  assert.ok(!/Approximate/.test(serif.badge), `serif still approximate: ${serif.badge}`)
  await page.locator('.font-choice').nth(0).click()
  // A plain description is still composed from its parts.
  const composed = await drawing(page, '⿰木木')
  assert.ok(!/Approximate/.test(composed.badge), composed.badge)
  assert.notDeepEqual(composed.ink, plain.ink)
  assert.deepEqual(errors, [])
  console.log('PASS a tagged description draws the character it names, a plain one composes')
} finally { await browser.close() }
