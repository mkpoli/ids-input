// Run against a local devrun/preview server with IDS_URL set:
//   IDS_URL=http://localhost:5193 bun demo/check-baishi.js
// Verifies the zi.tools IDS Extension specification page (/baishi) renders its attested variant
// glyph comparisons in light and dark schemes on both desktop and phone widths with no page errors,
// no horizontal overflow, preserved printed IDS rows, and distinct SVG outlines per variant.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const base = process.env.IDS_URL ?? 'http://localhost:5193'
const shots = process.env.IDS_PAGE_SHOTS
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })

try {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    for (const [name, width] of /** @type {const} */ ([['desktop', 1280], ['phone', 400]])) {
      const page = await browser.newPage({
        viewport: { width, height: name === 'phone' ? 860 : 900 },
        deviceScaleFactor: 2,
        colorScheme: scheme,
        hasTouch: name === 'phone',
      })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${base}/baishi.html?lang=zh-Hans`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      const view = `${name} ${scheme}`
      assert.deepEqual(errors, [], `${view}: no page errors`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${view}: no horizontal overflow`)

      // Every rendered glyph SVG has a non-empty path.
      const emptyPaths = await page.evaluate(() => [...document.querySelectorAll('article.example svg.glyph-svg path')]
        .filter(path => !(path.getAttribute('d') ?? '').startsWith('M')).length)
      assert.equal(emptyPaths, 0, `${view}: every example glyph SVG has a valid path`)

      // Key multi-variant and contrast cards render distinct outlines for their variants.
      const checked = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('article.example')]
        const pathsFor = (/** @type {string} */ needle) => {
          const card = cards.find(el => el.textContent?.includes(needle))
          return card ? [...card.querySelectorAll('svg.glyph-svg path')].map(p => p.getAttribute('d')) : []
        }
        return {
          gong: pathsFor('八T厶.(T)'),
          hui: pathsFor('叀y2002心'),
          leng: pathsFor('令H'),
          lingDao: pathsFor('令dhs'),
          zhai: pathsFor('斉J小.(J,J)'),
          lingRow: pathsFor('亽卩'),
          ucvKou: pathsFor('(q3162)'),
          ucvXu: pathsFor('(q008a2)'),
          printedLeng: cards.find(el => el.textContent?.includes('令H'))?.querySelector('.printed')?.textContent ?? '',
          segLabels: (() => {
            const card = cards.find(el => el.textContent?.includes('⿻[a]㇉一'))
            return card ? [...card.querySelectorAll('svg.glyph-svg')].map(s => s.getAttribute('aria-label')) : []
          })(),
        }
      })
      assert.equal(new Set(checked.gong).size, 2, `${view}: 公 contrasts (.) and (T)`)
      assert.equal(new Set(checked.hui).size, 3, `${view}: 惠 shows 惠 plus 叀. vs 叀y2002`)
      assert.equal(new Set(checked.leng).size, 3, `${view}: 冷 shows distinct (.), (H), (J) outlines`)
      assert.equal(new Set(checked.lingDao).size, 3, `${view}: 刢 shows distinct (.), (J), (T) outlines`)
      assert.equal(new Set(checked.zhai).size, 2, `${view}: 斎 contrasts (.) and (J,J)`)
      assert.equal(new Set(checked.lingRow).size, 6, `${view}: 令 shows its six attested variant outlines`)
      assert.equal(new Set(checked.ucvKou).size, 2, `${view}: 口 contrasts (.) and (q3162)`)
      assert.equal(new Set(checked.ucvXu).size, 2, `${view}: 烕 contrasts (.) and (q008a2)`)
      assert.ok(checked.printedLeng.includes(';'), `${view}: variant cards preserve printed semicolon IDS row`)
      assert.deepEqual(checked.segLabels, ['𠀁', '⿻[b]㇉一'], `${view}: 𠀁 segment comparison labels each SVG distinctly`)

      if (shots) {
        await page.locator('#variants .examples').first().scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollBy(0, -140))
        await page.screenshot({ path: `${shots}/baishi-after-${name}-variants-${scheme}.png` })
        if (name === 'desktop') {
          await page.locator('#rows .examples').first().scrollIntoViewIfNeeded()
          await page.evaluate(() => window.scrollBy(0, -100))
          await page.screenshot({ path: `${shots}/baishi-after-desktop-rows-${scheme}.png` })
          await page.locator('#ucv-position').scrollIntoViewIfNeeded()
          await page.evaluate(() => window.scrollBy(0, -80))
          await page.screenshot({ path: `${shots}/baishi-after-desktop-ucv-${scheme}.png` })
        }
      }
      await page.close()
    }
  }
  console.log('check-baishi.js passed')
} finally {
  await browser.close()
}
