// bun scripts/compare_krm_top.mjs HANDWRITING.png GLYPHWIKI.png [MAIN_REF]
// Writes the local review page; no deployment or repository asset upload.
import { cp, mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { compose, fromUrl } from '../src/composer/loader.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

const [handwriting, trace, ref = 'origin/main'] = process.argv.slice(2)
if (!handwriting || !trace) throw new Error('Supply the handwriting crop and GlyphWiki trace image')
const output = join(homedir(), '.local/share/show/pages/ids-krm-top')
const temporary = await mkdtemp(join(tmpdir(), 'krm-main-'))
let browser
try {
  const commit = execFileSync('git', ['rev-parse', ref], { encoding: 'utf8' }).trim()
  execFileSync('tar', ['-x', '-C', temporary], { input: execFileSync('git', ['archive', commit, 'src', 'data', 'package.json'], { maxBuffer: 100 * 1024 * 1024 }) })
  const main = await import(pathToFileURL(join(temporary, 'src/composer/loader.js')).href)
  await mkdir(output, { recursive: true })
  for (const dir of ['demo', 'design', 'fonts']) await mkdir(join(output, dir), { recursive: true })
  await cp('demo/app.css', join(output, 'demo/app.css'))
  await cp('design', join(output, 'design'), { recursive: true })
  await cp('fonts/Jigmo-ids-operators.woff2', join(output, 'fonts/operators.woff2'))
  await rm(join(output, 'handwriting.png'), { force: true })
  await cp(handwriting, join(output, 'handwriting.png'))
  await rm(join(output, 'trace.png'), { force: true })
  await cp(trace, join(output, 'trace.png'))
  const data = JSON.parse(await readFile('demo/lib/comparison.json', 'utf8'))
  const entry = data.entries.find(e => e.sequence === '⿳卜冖人')
  if (!entry?.kage?.length) throw new Error('Missing gallery KAGE reference')
  const svg = (paths, size = 1000) => `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${paths.map(d => `<path d="${d}" fill="currentColor"/>`).join('')}</svg>`
  const cell = (label, image) => `<figure>${image}<figcaption>${label}</figcaption></figure>`
  const manuscript = cell('Original handwriting', '<img src="handwriting.png" alt="KRM manuscript headword">')
  const cache = new Map()
  const cachedFetch = async url => {
    if (!cache.has(url)) cache.set(url, (async () => {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`Composer export: ${r.status}`)
      return await r.arrayBuffer()
    })())
    return new Response(await cache.get(url))
  }
  let sections = ''
  for (const style of ['sans', 'serif']) {
    const options = { fontStyle: style }
    const source = () => fromUrl(COMPOSER_BASES[style], { fetch: cachedFetch })
    const wrong = await main.compose(source(), '⿳卜冖人', options)
    const correct = await compose(source(), '⿳⺊冖人', options)
    const mainCorrect = await main.compose(source(), '⿳⺊冖人', options)
    for (const theme of ['light', 'dark']) {
      sections += `<section id="${style}-${theme}" style="color-scheme:${theme}"><h2>${style === 'sans' ? 'Sans' : 'Serif'} · ${theme}</h2><div class="row">${manuscript}${cell('GlyphWiki trace · ⿳⺊冖人', '<img src="trace.png" alt="GlyphWiki trace of the headword">')}${cell('Gallery KAGE · ⿳卜冖人', svg(entry.kage, 200))}</div><div class="row">${manuscript}${cell('Main · incorrect IDS ⿳卜冖人', svg([wrong.d]))}${cell('Branch · correct IDS ⿳⺊冖人', svg([correct.d]))}</div><div class="row">${manuscript}${cell('Main · correct IDS ⿳⺊冖人', svg([mainCorrect.d]))}${cell('Branch · correct IDS ⿳⺊冖人', svg([correct.d]))}</div><p>Main: ${commit.slice(0, 12)} · KAGE paths from the comparison gallery, rendered in its 200-unit frame.</p></section>`
    }
  }
  await writeFile(join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>KRM top comparison</title><link rel="stylesheet" href="demo/app.css"><style>
@font-face{font-family:Operators;src:url(fonts/operators.woff2)}
body{margin:24px;font-family:var(--ui-font-sans);background:var(--ui-color-canvas);color:var(--ui-color-ink)}h1{font-size:24px}h2{font-size:20px;margin:0 0 18px}section{padding:24px;margin:24px 0;width:1000px;background:var(--ui-color-canvas);color:var(--ui-color-ink)}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:16px 0}figure{margin:0;padding:14px;background:var(--ui-color-surface);border:1px solid var(--ui-color-border)}figure svg,figure img{width:100%;height:220px;object-fit:contain}figcaption{margin-top:12px;font-family:Operators,var(--cjk-sans);font-size:16px}p{font-size:13px;color:var(--ui-color-ink-muted)}a{color:var(--ui-color-accent)}</style><h1>KRM top comparison</h1><p>Each face uses its own 上 and 冖 donors. The rightward bar follows the extended form in the GlyphWiki trace.</p><nav>${['sans','serif'].flatMap(s => ['light','dark'].map(t => `<a href="${s}-${t}@2x.png">${s} ${t} · 2×</a>`)).join(' · ')}</nav>${sections}</html>`)
  // Serve the stable folder through show, then capture each comparison at 2×.
  execFileSync('show', [output], { stdio: 'pipe' })
  const cacheDir = join(homedir(), '.cache/ms-playwright')
  const versions = (await readdir(cacheDir)).filter(n => n.startsWith('chromium-')).sort().reverse()
  browser = await chromium.launch({ executablePath: join(cacheDir, versions[0], 'chrome-linux64/chrome') })
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 2 })
  await page.goto('http://localhost:8790/ids-krm-top/', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  for (const style of ['sans', 'serif']) for (const theme of ['light', 'dark']) {
    await page.locator(`#${style}-${theme}`).screenshot({ path: join(temporary, `${style}-${theme}@2x.png`), animations: 'disabled' })
  }
  for (const style of ['sans', 'serif']) for (const theme of ['light', 'dark']) {
    await cp(join(temporary, `${style}-${theme}@2x.png`), join(output, `${style}-${theme}@2x.png`))
  }
  console.log(`Rendered four 2× comparisons. Main: ${commit}`)
} finally {
  await browser?.close()
  await rm(temporary, { recursive: true, force: true })
}
