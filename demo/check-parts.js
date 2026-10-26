// Built palette in Chromium, with a local composer fixture: devrun bun demo/check-parts.js.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { files, shardOf } from '../tests/fixtures/composer-export.js'
import { isSequence, leaves, parse } from '../src/core/ids.js'

const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
const compounds = palette.parts.filter(row => isSequence(row[0])).map(row => row[0])
// Test glyphs are deliberately simple outlines, as in the shared composer fixture.
const fixture = { ...files }
const template = Object.values(JSON.parse(gunzipSync(files[shardOf('g', '永')])))[0]
for (const char of new Set(compounds.flatMap(text => leaves(parse(text).tree).map(leaf => leaf.char)))) {
  const path = shardOf('g', char)
  const shard = fixture[path] ? JSON.parse(gunzipSync(fixture[path])) : {}
  shard[createHash('sha256').update(char).digest('hex')] = { ...template, k: char }
  fixture[path] = gzipSync(JSON.stringify(shard))
}
const root = join(import.meta.dirname, '..', 'dist')
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const path = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^\/+/, '') || 'index.html'
  if (path.startsWith('composer/')) {
    const body = fixture[path.slice('composer/'.length)]
    // Leave requests pending briefly to expose cancellation between icons and the editor.
    await Bun.sleep(20)
    return body === undefined ? new Response('missing', { status: 404 }) : new Response(body)
  }
  const file = Bun.file(join(root, path))
  return await file.exists() ? new Response(file) : new Response('missing', { status: 404 })
} })
const base = `http://127.0.0.1:${server.port}/`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const assert = (condition, message) => { if (!condition) throw Error(message) }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://glyphatlas.org/**', route => route.abort())
  await page.goto(`${base}?composer=${encodeURIComponent(base + 'composer/')}#${encodeURIComponent('⿰木口')}`)
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.locator('.part.compound').first().waitFor()
  assert(await page.locator('.part.compound').count() === compounds.length, 'all compounds in Common')
  for (const text of compounds) {
    const cell = page.locator('.part.compound').and(page.getByRole('button', { name: new RegExp('^' + text) }))
    await cell.scrollIntoViewIfNeeded()
    await cell.locator('.part-icon svg > path[d]').waitFor()
    assert((await cell.getAttribute('title')).startsWith(text), 'sequence in hover tooltip')
    assert((await cell.innerText()).trim() === 'IDS', 'compound displays an icon and marker')
  }
  await page.locator('.ids-preview[data-step="composed"]').waitFor()
  await page.locator('.parts-filter').fill('⿰冫⿱丿丶')
  const cell = page.locator('.part.compound')
  assert(await cell.count() === 1, 'full IDS filter')
  assert((await cell.getAttribute('title')).includes('4'), 'manual shortcut stroke count')
  await page.locator('.ids-part').last().click()
  await cell.click()
  await page.waitForFunction(() => document.querySelector('.ids-field input').value === '⿰木⿰冫⿱丿丶')
  await page.locator('.ids-preview[data-step="composed"]').waitFor()
  await page.locator('.parts-filter').fill('4')
  assert(await page.locator('.part.compound').count() === 3, 'stroke-count filter')
  await page.locator('.parts-filter').fill('')
  await page.getByRole('tab', { name: 'Recent', exact: true }).click()
  assert(await page.locator('.part.compound').count() === 1, 'compound in Recent')
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme })
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 })
      assert(!await cell.evaluate(node => node.scrollWidth > node.clientWidth + 1), 'icon stays inside its cell')
    }
  }
  assert(errors.length === 0, errors.join('\n'))
  console.log('PASS compound icons, hover IDS, manual shortcut, insertion, filters, Recent, concurrent preview, light/dark desktop/mobile')
} finally {
  await browser.close()
  server.stop(true)
}
