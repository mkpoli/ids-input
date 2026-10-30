// IDS_URL=http://127.0.0.1:5197 CHROMIUM_PATH=/path/to/chrome bun demo/check-glyph-regressions.js
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const cases = [
  ['shuang', '⿻大㸚'],
  ['tou', '⿻⺀大'],
  ['biang', '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心'],
]
const out = process.env.SHOTS ?? '/tmp/glyph-regressions'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://127.0.0.1:5197', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.waitFor()
    for (const [name, sequence] of cases) {
      await field.fill(sequence)
      await field.dispatchEvent('input')
      await page.waitForFunction(() => {
        const meta = document.querySelector('.ids-preview-meta')?.textContent ?? ''
        return /U\+/.test(meta) && !/Composing/.test(meta) && document.querySelector('.ids-preview-large svg path')
      }, null, { timeout: 120000 })
      let previous = '', stable = 0
      for (let i = 0; i < 100 && stable < 4; i++) {
        await page.waitForTimeout(300)
        const paths = await page.locator('.preview .ids-preview-large svg path').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')).join('|'))
        stable = paths && paths === previous ? stable + 1 : 0
        previous = paths
      }
      assert.ok(stable >= 4, `${name}: drawing did not settle`)
      const meta = await page.locator('.preview .ids-preview-meta').innerText()
      console.log(theme, name, meta.replace(/\s+/g, ' '))
      if (!process.env.BASELINE) assert.doesNotMatch(meta, /Cells|Failed/)
      await page.locator('.preview').screenshot({ path: `${out}/${name}-${theme}.png` })
    }
    assert.deepEqual(errors, [])
    await page.close()
  }
} finally { await browser.close() }
