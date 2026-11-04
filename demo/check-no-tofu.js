// The workshop in a browser with no CJK font installed: every character in the parts palette and in
// the sequence field must come from the app's own webfonts, never from the browser's last-resort box.
//
// The page runs under a fontconfig that offers one Latin font and nothing else, so a character no
// bundled face draws can only appear as the missing-glyph box. A glyph is judged a box by rendering
// it and an unassigned code point with the element's own font stack: the box both draw is the same
// shape, while a real glyph differs everywhere it has ink. Characters below the fold are scrolled
// into view first, since the app loads a shard only for text a reader has seen.
//
// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-no-tofu.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** A fontconfig directory with one Latin font: no CJK face is visible to the browser. */
function latinOnlyFontconfig() {
  const latin = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'].find(existsSync)
  if (!latin) return undefined
  const root = mkdtempSync(join(tmpdir(), 'ids-no-cjk-'))
  const fonts = join(root, 'fonts')
  mkdirSync(fonts)
  symlinkSync(latin, join(fonts, 'Latin.ttf'))
  const conf = join(root, 'fonts.conf')
  writeFileSync(conf, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fonts}</dir>
  <cachedir>${join(root, 'cache')}</cachedir>
</fontconfig>
`)
  return conf
}

/** The palette's tabs, each a set of parts drawn with the app's faces. */
const TABS = ['Components', 'Gongche', 'Tangut', 'Small Seal', 'Shuishu', 'Bopomofo', 'Marks', 'Letters & numbers', 'Hangul', 'Other scripts']

/**
 * In the page: the characters of `selector` that draw the missing-glyph box, with the element's own
 * font stack as the judge. A box scores near zero against the unassigned code point U+10FFFF, a real
 * glyph well above one.
 */
const boxedIn = ({ selector, limit }) => {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const context = canvas.getContext('2d')
  const pixels = text => {
    context.clearRect(0, 0, 48, 48)
    context.fillText(text, 4, 40)
    return context.getImageData(0, 0, 48, 48).data
  }
  const ink = data => { let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 100) n++; return n }
  const boxed = []
  for (const element of [...document.querySelectorAll(selector)].slice(0, limit)) {
    const text = (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent ?? '').trim()
    if (!text) continue
    const font = getComputedStyle(element).fontFamily
    context.font = `32px ${font}`
    const box = pixels('\u{10FFFF}')
    context.font = `32px ${font}`
    const glyph = pixels(text)
    const glyphInk = ink(glyph)
    if (!glyphInk) { boxed.push(text); continue }
    let changed = 0
    for (let i = 3; i < glyph.length; i += 4) if (Math.abs(glyph[i] - box[i]) > 40) changed++
    if (changed / Math.max(ink(box), glyphInk, 1) < 0.15) boxed.push(text)
  }
  return boxed
}

/** The characters under `selector` that draw a box, waiting for shards that arrive after the paint. */
async function boxedInPage(page, selector, limit = 120) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const boxed = await page.evaluate(boxedIn, { selector, limit })
    if (!boxed.length) return []
    await page.waitForTimeout(500)
    if (attempt === 19) return boxed
  }
  return []
}

/**
 * Scrolls every match into view, so the app asks for the shard of text it had not shown yet: a part
 * below the fold has no glyph until a reader sees it.
 */
async function reveal(page, selector, limit = 120) {
  await page.evaluate(async ({ selector, limit }) => {
    for (const element of [...document.querySelectorAll(selector)].slice(0, limit)) {
      element.scrollIntoView({ block: 'center' })
      await new Promise(resolve => setTimeout(resolve, 60))
    }
  }, { selector, limit })
  await page.waitForTimeout(1200)
}

if (process.platform !== 'linux') {
  console.log('SKIP no-tofu: hiding the installed fonts is a fontconfig setup')
  process.exit(0)
}
const fontconfig = latinOnlyFontconfig()
if (!fontconfig) {
  console.log('SKIP no-tofu: no Latin font to keep the browser drawing UI text')
  process.exit(0)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, env: { ...process.env, FONTCONFIG_FILE: fontconfig } })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(`${process.env.IDS_URL ?? 'http://localhost:5173'}/?lang=en`)
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.locator('.parts-grid .part').first().waitFor()
  await page.waitForTimeout(2000)
  const failures = []
  for (const tab of TABS) {
    const button = page.getByRole('tab', { name: tab, exact: true })
    if (!await button.count()) { console.log(`skip the ${tab} palette: no such tab`); continue }
    await button.first().click()
    await page.waitForTimeout(1500)
    await page.evaluate(() => document.fonts.ready)
    if (!await page.locator('.parts-grid .part').count()) { console.log(`skip the ${tab} palette: no parts`); continue }
    await reveal(page, '.parts-grid .part')
    const boxed = await boxedInPage(page, '.parts-grid .part')
    console.log(`${tab}: ${boxed.length ? `${boxed.length} boxed (${boxed.slice(0, 6).join(' ')})` : 'every part draws'}`)
    if (boxed.length) failures.push(`${tab}: ${boxed.join(' ')}`)
  }
  // The search results and the tree show characters as well.
  for (const [what, selector] of [['search results', '.ids-search-results .char'], ['tree', '.ids-tree .ids-part[data-character]']]) {
    if (!await page.locator(selector).count()) { console.log(`skip the ${what}: nothing shown`); continue }
    await reveal(page, selector)
    const boxed = await boxedInPage(page, selector)
    console.log(`${what}: ${boxed.length ? `${boxed.length} boxed (${boxed.slice(0, 6).join(' ')})` : 'every character draws'}`)
    if (boxed.length) failures.push(`${what}: ${boxed.join(' ')}`)
  }
  // The sequence field takes characters typed by hand, including ones only the shards draw.
  const input = page.locator('.sequence-wrap input').first()
  await input.click()
  await input.fill('𥫗')
  await page.waitForTimeout(2500)
  const typed = await page.evaluate(() => document.querySelector('.sequence-wrap input').value)
  const boxedTyped = await page.evaluate(boxedIn, { selector: '.sequence-wrap input', limit: 1 })
  console.log(`sequence field: ${boxedTyped.length ? 'draws a box for 𥫗' : `draws ${typed}`}`)
  if (boxedTyped.length) failures.push('sequence field: 𥫗')
  assert.deepEqual(failures, [], 'no character of the workshop draws as the missing-glyph box')
  console.log('PASS every character comes from the app\u2019s own faces, with no CJK font installed')
} finally {
  await browser.close()
}
