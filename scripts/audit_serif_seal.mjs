// Render serif glyphs with and without the 2-unit seam stroke the preview carried until #389, light
// and dark, at preview size: bun scripts/audit_serif_seal.mjs OUT_DIR [SEQUENCE...]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { compose, fromUrl } from '../src/composer/loader.js'
import { drawingSvg } from '../src/core/preview.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

const [dir, ...sequences] = process.argv.slice(2)
if (!dir) throw Error('Usage: bun scripts/audit_serif_seal.mjs OUT_DIR [SEQUENCE...]')
const ink = { light: ['#1d1d21', '#ffffff'], dark: ['#f5f2ea', '#121213'] }
mkdirSync(dir, { recursive: true })
const source = fromUrl(COMPOSER_BASES.serif)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  let index = 0
  for (const sequence of sequences.length ? sequences : ['o', '6', '目', '三', '⿰鬱鬱']) {
    const drawn = await compose(source, sequence, { fontStyle: 'serif' })
    for (const seal of [0, 2])
      for (const [scheme, [inkColour, background]] of Object.entries(ink)) {
        const svg = drawingSvg(drawn, { background, ink: inkColour, size: 1000 })
        // The ink path is the last one: a cut drawing puts its mask path first.
        const at = svg.lastIndexOf('<path ')
        const body = seal ? svg.slice(0, at) + svg.slice(at).replace('<path ', `<path stroke="${inkColour}" stroke-width="${seal}" stroke-linejoin="round" `) : svg
        const page = await browser.newPage({ viewport: { width: 340, height: 340 }, deviceScaleFactor: 3 })
        const image = Buffer.from(body).toString('base64')
        await page.setContent(`<body style="margin:0;display:grid;place-items:center;height:340px;background:${background}"><img src="data:image/svg+xml;base64,${image}" width=324 height=324></body>`)
        await page.screenshot({ path: join(dir, `g${index}-${scheme}-${seal ? 'seal' : 'plain'}.png`) })
        await page.close()
      }
    index++
  }
} finally { await browser.close() }
