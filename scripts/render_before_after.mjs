// bun scripts/render_before_after.mjs --out DIR --cases FILE [--whole]
// bun scripts/render_before_after.mjs --check BEFORE_DIR AFTER_DIR
//
// Draws a list of descriptions the same way every time, so a before image and an after image differ
// only by the code that drew them. Each case is drawn beside the export's own drawing of the
// character, every part over the others so overlaps show, in light and dark. A drawing is separated
// into one piece per leaf; --whole draws the composition without that split.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright-core'
import { compose, createSource } from '../src/composer/loader.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

const args = process.argv.slice(2)
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1] }
const CACHE = join(import.meta.dir, '..', 'cache', 'glyph-layout')
const SIZE = 180
const THEMES = ['light', 'dark']

if (args[0] === '--check') {
  const [before, after] = args.slice(1)
  if (!before || !after) throw Error('Usage: bun scripts/render_before_after.mjs --check BEFORE_DIR AFTER_DIR')
  const read = async directory => JSON.parse(await readFile(join(resolve(directory), 'cases.json'), 'utf8'))
  const [a, b] = await Promise.all([read(before), read(after)])
  const problems = []
  if (a.length !== b.length) problems.push(`${a.length} cases before, ${b.length} after`)
  a.forEach((entry, index) => {
    if (b[index]?.label !== entry.label) problems.push(`case ${index + 1}: ${entry.label} before, ${b[index]?.label ?? 'missing'} after`)
    if (b[index]?.separate !== entry.separate) problems.push(`case ${index + 1}: separate ${entry.separate} before, ${b[index]?.separate} after`)
  })
  for (const theme of THEMES) {
    const [x, y] = await Promise.all([before, after].map(async directory => {
      const bytes = await readFile(join(resolve(directory), `${theme}.png`))
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    }))
    if (x.width !== y.width || x.height !== y.height) problems.push(`${theme}: ${x.width}x${x.height} before, ${y.width}x${y.height} after`)
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
  console.log(`Same ${a.length} cases, same order, same image size in ${THEMES.join(' and ')}.`)
  process.exit(0)
}

const out = option('--out')
const casesFile = option('--cases')
if (!out || !casesFile) throw Error('Usage: bun scripts/render_before_after.mjs --out DIR --cases FILE [--whole]')
const whole = args.includes('--whole')
const cases = JSON.parse(await readFile(resolve(casesFile), 'utf8'))
if (!Array.isArray(cases) || !cases.length) throw Error('The case list is empty')
for (const entry of cases) {
  if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') {
    throw Error(`A case is [label, description]: ${JSON.stringify(entry)}`)
  }
}

// The export is pinned by its base URL, so a before image and an after image read the same files.
const directory = join(CACHE, createHash('sha256').update(COMPOSER_BASES.sans).digest('hex').slice(0, 16))
const read = async name => {
  try {
    const bytes = await readFile(join(directory, name))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    // A file the cache lacks is fetched once and kept, so both runs read the same bytes.
    const response = await fetch(COMPOSER_BASES.sans + name)
    if (response.status === 404) return null
    if (!response.ok) throw Error(`${name}: ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    await mkdir(join(directory, name).replace(/\/[^/]+$/, ''), { recursive: true })
    await writeFile(join(directory, name), bytes)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
}
const source = () => createSource(read, { concurrency: 2 })

const drawn = []
for (const [label, description] of cases) {
  const composition = await compose(source(), description, { separate: !whole })
  let glyph = null
  try { glyph = await compose(source(), label) } catch { glyph = null }
  drawn.push({ label, description, composition, glyph })
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
// Every part over the others: a union would hide the overlaps that make a drawing read wrong.
const svg = (drawing, id) => {
  if (!drawing) return '<div class="absent">no drawing</div>'
  const parts = drawing.parts?.length ? drawing.parts : [{ d: drawing.d, cut: drawing.cut }]
  return `<svg viewBox="0 0 1000 1000" width="${SIZE}" height="${SIZE}"><defs><mask id="${id}">${
    parts.map(part => `<path d="${escape(part.d)}" fill="${part.cut ? '#000' : '#fff'}"/>`).join('')
  }</mask></defs><rect width="1000" height="1000" fill="none" stroke="var(--edge)"/><rect width="1000" height="1000" fill="currentColor" mask="url(#${id})"/></svg>`
}

await mkdir(resolve(out), { recursive: true })
// The label's sequence needs the project's IDS faces; a system font leaves the operators as boxes.
const face = async (family, file, range) => {
  const bytes = await readFile(join(import.meta.dir, '..', 'fonts', file))
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2")${range ? `;unicode-range:${range}` : ''}}`
}
const faces = (await Promise.all([
  face('IDS Operators', 'NotoSansCJKjp-ids-operators.woff2', 'U+2FF0-2FFB'),
  face('IDS Operators', 'Jigmo-ids-operators.woff2', 'U+2FFC-2FFF'),
  face('IDS Parts', 'Plangothic-ids-parts.woff2', 'U+2E80-2EFF,U+31E4-31EF,U+20000-3FFFF'),
  face('IDS Strokes', 'NotoSansCJKjp-ids-strokes.woff2', 'U+2B1A,U+31C0-31E3'),
  face('GenZui Sans', 'GenZuiSans-Regular.woff2'),
])).join('')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 900, height: 300 }, deviceScaleFactor: 2 })
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      ${faces}
      :root { color-scheme: ${theme}; --edge: ${theme === 'dark' ? '#333' : '#ddd'}; }
      body { margin: 0; padding: 12px; background: ${theme === 'dark' ? '#141414' : '#fff'}; color: ${theme === 'dark' ? '#f2f2f2' : '#111'}; font: 12px system-ui; }
      .case { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
      .label { width: 120px; font-size: 13px; }
      .label b { font: 22px/1.2 "IDS Operators", "IDS Strokes", "IDS Parts", "GenZui Sans", system-ui; }
      .label code { display: block; font-family: "IDS Operators", "IDS Strokes", "IDS Parts", "GenZui Sans", ui-monospace, monospace; font-size: 11px; opacity: .7; overflow-wrap: anywhere; }
      figure { margin: 0; text-align: center; }
      figcaption { font-size: 11px; }
      .absent { width: ${SIZE}px; height: ${SIZE}px; display: grid; place-items: center; color: gray; }
    </style><body>${drawn.map((entry, index) => `<div class="case">
      <div class="label"><b>${escape(entry.label)}</b><code>${escape(entry.description)}</code></div>
      <figure>${svg(entry.composition, `c${index}`)}<figcaption>composition</figcaption></figure>
      <figure>${svg(entry.glyph, `g${index}`)}<figcaption>export glyph</figcaption></figure>
    </div>`).join('')}</body>`)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: join(resolve(out), `${theme}.png`), fullPage: true })
    await page.close()
  }
} finally {
  await browser.close()
}
await writeFile(join(resolve(out), 'cases.json'), JSON.stringify(cases.map(([label, description]) => ({ label, description, separate: !whole })), null, 1) + '\n')
console.log(`Wrote ${cases.length} cases to ${resolve(out)}`)
