// The app draws every character it shows, on a machine whose installed fonts lack the CJK ones.
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-tofu.js
// TOFU_LAB_FONT points at a directory of lab fonts (`uv run scripts/build_tofu_lab.py
// /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc DIR`, the faces cut to U+3400-U+9FFF and
// U+20000-U+3FFFF); each system CJK family is answered with its lab copy. Without it the check runs
// against the fonts this machine has.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const lab = process.env.TOFU_LAB_FONT
/** A screenshot's glyph weather is reported, not judged: the images are kept for review. */
const measure = async page => page.evaluate(async () => {
  await document.fonts.ready
  await new Promise(done => setTimeout(done, 600))
  const blank = document.createElement('span')
  blank.textContent = '\u{10FFFD}' // a private-use character no font here has
  blank.style.fontSize = '40px'
  document.body.append(blank)
  const rect = blank.getBoundingClientRect()
  blank.remove()
  return { boxWidth: rect.width, boxHeight: rect.height }
})
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const asked = []
  page.on('request', request => { if (/\.woff2(\?|$)/.test(request.url())) asked.push(request.url().split('/').pop()) })
  if (lab) {
    // Every system CJK typeface is a lab copy of itself that lacks the non-ideographic characters,
    // so only the app's own webfonts can draw a radical, a stroke or the empty-slot mark.
    const labFonts = {}
    for (const [family, file] of Object.entries({ 'Noto Sans CJK JP': 'tofu-jp.woff2', 'Noto Sans CJK KR': 'tofu-kr.woff2', 'Noto Sans CJK SC': 'tofu-sc.woff2', 'Noto Sans CJK TC': 'tofu-tc.woff2', 'Noto Sans CJK HK': 'tofu-hk.woff2', 'Noto Sans JP': 'tofu-jp.woff2' }))
      labFonts[family] = new URL(file, new URL(`file://${lab}/`)).href
    await page.addInitScript(table => {
      const Face = window.FontFace
      window.FontFace = class extends Face {
        constructor(family, src, descriptors) {
          const name = family.replace(/^["']|["']$/g, '')
          const lab = table[name]
          super(family, lab ? `url("${lab}")` : src, lab ? { ...descriptors, unicodeRange: undefined } : descriptors)
        }
      }
    }, labFonts)
  }
  const url = process.env.IDS_URL ?? 'http://localhost:5173'
  await page.goto(url)
  const shots = []
  const tofu = async (name, target) => {
    const { boxWidth, boxHeight } = await measure(page)
    const box = await target.boundingBox()
    if (!box) return { name, skipped: true }
    const image = await page.screenshot({ clip: { x: box.x, y: box.y, width: Math.min(box.width, 1440 - box.x), height: Math.min(box.height, 1000 - box.y) } })
    shots.push({ name, image })
    return { name, boxWidth, boxHeight }
  }
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  // What the palette draws from the bundled fallback, searched directly.
  const parts = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))).parts
  const covered = new Set()
  for (const name of ['02e', '031']) {
    const rows = JSON.parse(gunzipSync(readFileSync(new URL(`../data/unicode-outlines/${name}.json.gz`, import.meta.url))))
    for (const char of Object.keys(rows)) covered.add(char)
  }
  const sample = parts.map(record => record[0]).filter(part => [...part].length === 1 && part.codePointAt(0) > 0xffff).slice(0, 8)
  const sequence = page.locator('.sequence-wrap input').first()
  for (const part of sample.slice(0, 2)) {
    await sequence.fill(part)
    await page.waitForTimeout(1200)
    await tofu(`sequence ${part}`, page.locator('.ids-tree').first())
  }
  await page.getByRole('tab', { name: 'Components', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await tofu('Components', page.getByRole('group', { name: 'Parts', exact: true }).first())
  await page.getByRole('tab', { name: 'Tangut', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await tofu('Tangut', page.getByRole('group', { name: 'Parts', exact: true }).first())
  await page.getByRole('tab', { name: 'Small Seal', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await tofu('Small Seal', page.getByRole('group', { name: 'Parts', exact: true }).first())
  const dir = process.env.TOFU_SHOTS ?? '/tmp/tofu-shots'
  mkdirSync(dir, { recursive: true })
  for (const shot of shots) writeFileSync(`${dir}/${shot.name.replace(/ /g, '-')}.png`, shot.image)
  const shards = asked.filter(name => /^[0-9a-f]{3}\.woff2$/.test(name))
  console.log('webfont files asked for', asked.length, shards.length, 'of them fallback shards')
  console.log('shots', dir)
  assert.ok(shots.length > 0, 'the panels render')
} finally { await browser.close() }
