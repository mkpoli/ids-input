// CHROMIUM_PATH=/path/to/chrome bun scripts/check_glyph_audit_preview.mjs REPORT_DIR SITE_URL [MAX_CASES]
// Save browser evidence for high-priority candidates; no automatic correctness verdict.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from 'playwright-core'

const [directoryArg, base, countArg = '6'] = process.argv.slice(2)
const count = Number(countArg)
if (!directoryArg || !base || !Number.isInteger(count) || count < 1) throw Error('Usage: bun scripts/check_glyph_audit_preview.mjs REPORT_DIR SITE_URL [MAX_CASES]')
const directory = resolve(directoryArg)
const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'))
const rows = report.rows.filter(row => row.flags.some(flag => flag.code === 'auto-cells-enclosure') && row.char)
  .sort((a, b) => (a.raster?.iou ?? 1) - (b.raster?.iou ?? 1))
const seen = new Set()
const picked = rows.filter(row => { if (seen.has(row.char)) return false; seen.add(row.char); return true }).slice(0, count)
const out = join(directory, 'preview')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const evidence = { site: base, checkedAt: new Date().toISOString(), scope: 'Browser screenshots of unique-character automatic-cell enclosure candidates; manual visual verification required.', cases: [] }
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme })
    const url = new URL(base)
    url.searchParams.set('lang', 'en')
    await page.goto(url.href, { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.waitFor()
    for (const row of picked) {
      await field.fill(row.sequence)
      await field.dispatchEvent('input')
      const code = `U+${row.char.codePointAt(0).toString(16).toUpperCase()}`
      await page.waitForFunction(code => {
        const meta = document.querySelector('.preview .ids-preview-meta')?.textContent ?? ''
        return meta.includes(code) && !/Composing/.test(meta) && document.querySelector('.preview .ids-preview-large svg path')
      }, code, { timeout: 120000 })
      let previous = '', stable = 0
      for (let attempt = 0; attempt < 100 && stable < 4; attempt++) {
        await page.waitForTimeout(300)
        const paths = await page.locator('.preview .ids-preview-large svg path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')).join('|'))
        stable = paths && paths === previous ? stable + 1 : 0
        previous = paths
      }
      if (stable < 4) throw Error(`Unsettled preview for ${row.id}`)
      const meta = await page.locator('.preview .ids-preview-meta').innerText()
      const path = `${row.id}-${theme}.png`
      await page.locator('.preview').screenshot({ path: join(out, path) })
      evidence.cases.push({ id: row.id, char: row.char, sequence: row.sequence, theme, meta, screenshot: `preview/${path}` })
      console.log(theme, code, meta.replace(/\s+/g, ' '))
    }
    await page.close()
  }
} finally {
  await writeFile(join(directory, 'preview-evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
  await browser.close()
}
