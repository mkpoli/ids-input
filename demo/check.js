#!/usr/bin/env bun
// The built demo (dist/) in a headless Chromium: the editor's verbs by keyboard and pointer, the
// parts palette, "Take parts from" and the component search, then screenshots at 2x, light and dark.
//
//   bun run build:demo && bun demo/check.js [--shots DIR] [--chromium PATH]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { files as composerFiles } from '../tests/fixtures/composer-export.js'

const arg = name => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : undefined }
const shots = arg('--shots') ?? 'shots'
const executablePath = arg('--chromium') ?? process.env.CHROMIUM_PATH
mkdirSync(shots, { recursive: true })
const root = join(import.meta.dirname, '..', 'dist')
// The small export of the composer tests, served beside the demo for the preview to draw from.
const server = Bun.serve({ port: 0, fetch(request) {
  const path = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^\/+/, '') || 'index.html'
  if (path.startsWith('composer/')) {
    const body = composerFiles[path.slice('composer/'.length)]
    return body === undefined ? new Response('missing', { status: 404 }) : new Response(body)
  }
  const file = Bun.file(join(root, path.endsWith('/') ? path + 'index.html' : path))
  return file.exists().then(found => found ? new Response(file) : new Response('missing', { status: 404 }))
} })
const url = `http://localhost:${server.port}/`
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const browser = await chromium.launch({ executablePath })
const pass = message => console.log('PASS', message)
// The real export is another site's: the check never reaches it, and sees the preview fail cleanly.
const offline = page => page.context().route('https://glyphatlas.org/**', route => route.abort())
try {
  const page = await browser.newPage({ viewport: { width: 820, height: 1100 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const value = () => page.locator('.ids-field input').inputValue()
  await offline(page)
  await page.goto(url)
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰𠤕⿱龴疋', null, { timeout: 15000 })
  pass('the editor starts from 疑\'s own description')

  // The operators in three groups by how many parts they take, each with its key on it.
  const groups = await page.locator('.ids-op-group').evaluateAll(els => els.map(el => [el.querySelector('.ids-op-label').textContent, el.querySelectorAll('.ids-key').length]))
  assert(JSON.stringify(groups) === JSON.stringify([['1 part', 3], ['2 parts', 13], ['3 parts', 2]]), `groups: ${JSON.stringify(groups)}`)
  assert(await page.locator('.ids-key[data-op="⿾"] .ids-kbd').textContent() === 'e', 'each operator shows its key')
  pass('operators grouped by their parts, keys shown')

  // Typed with ASCII names, the field writes operators.
  await page.locator('.ids-field input').fill('')
  await page.locator('.ids-field input').pressSequentially('LR亻')
  assert(await value() === '⿰亻', `typed: ${await value()}`)
  assert((await page.locator('.ids-pending').textContent())?.includes('2'), 'the empty slot is named')
  pass('ASCII names are read as operators, and an empty slot is named')

  // A key on the tree: the second slot chosen, 2 splits it, a part typed fills it.
  await page.locator('.ids-part.empty').click()
  await page.keyboard.press('Digit2')
  assert(await value() === '⿰亻⿱⬚⬚', `split: ${await value()}`)
  await page.locator('.ids-slot input').fill('七')
  await page.locator('.ids-slot input').press('Enter')
  await page.locator('.ids-slot input').fill('木')
  await page.locator('.ids-slot input').press('Enter')
  assert(await value() === '⿰亻⿱七木', `filled: ${await value()}`)
  assert(await page.locator('.ids-use').isEnabled(), 'a whole sequence can be used')
  pass('operator keys split a slot, and parts typed fill the slots in turn')

  // Tab steps through the parts; a letter typed on the tree goes to the part field; Backspace empties.
  await page.locator('.ids-op').first().focus()
  await page.keyboard.press('Tab')
  assert(await page.evaluate(() => document.activeElement?.dataset.path) === '0', 'Tab reaches the first part')
  await page.keyboard.press('Shift+Tab')
  assert(await page.evaluate(() => document.activeElement?.dataset.path) === '', 'Shift+Tab steps back')
  await page.keyboard.press('Tab')
  await page.keyboard.press('KeyK')
  assert(await page.locator('.ids-slot input').inputValue() === 'k' && await page.evaluate(() => document.activeElement?.closest('.ids-slot') !== null), 'a typed letter goes to the part field')
  await page.locator('.ids-part').first().focus()
  await page.keyboard.press('Backspace')
  assert(await value() === '⿰⬚⿱七木', `cleared: ${await value()}`)
  await page.keyboard.press('Control+z')
  assert(await value() === '⿰亻⿱七木', `undo clear: ${await value()}`)
  pass('Tab and Shift+Tab, typing on the tree, Backspace')

  // An operator on a node swaps it, refusing to drop a filled part; × takes a level away; undo, redo.
  await page.locator('.ids-op').nth(1).click()
  await page.keyboard.press('Equal')
  assert(await value() === '⿰亻⿻七木', `swap: ${await value()}`)
  await page.keyboard.press('KeyE')
  assert(await value() === '⿰亻⿻七木' && (await page.locator('.ids-problem').textContent()).length > 0, 'a swap dropping a part is refused')
  await page.locator('.ids-unwrap').nth(1).click()
  assert(await value() === '⿰亻七', `unwrap: ${await value()}`)
  await page.locator('.ids-op').first().focus()
  await page.keyboard.press('Control+z')
  assert(await value() === '⿰亻⿻七木', `undo: ${await value()}`)
  await page.keyboard.press('Control+Shift+z')
  assert(await value() === '⿰亻七', `redo: ${await value()}`)
  await page.keyboard.press('Control+z')
  pass('swaps, refusals, × and undo and redo')

  // The find tab: a component by character or code point.
  await page.locator('.ids-part').nth(2).click()
  await page.locator('.ids-find input').fill('U+6728')
  await page.locator('.ids-hit').first().waitFor()
  await page.locator('.ids-hit').first().click()
  assert(await value() === '⿰亻⿻七木', `found: ${await value()}`)
  pass('a component found by its code point replaces the chosen part')

  // The parts palette: a hard-to-type part picked into the chosen slot, then kept as recent.
  await page.locator('.ids-part').nth(0).click()
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.locator('.parts-tabs [role="tab"]', { hasText: 'Hard to type' }).click()
  const part = await page.locator('.parts-grid .part').first().textContent()
  await page.locator('.parts-grid .part').first().click()
  assert(await value() === `⿰${part}⿻七木`, `palette: ${await value()}`)
  await page.locator('.parts-tabs [role="tab"]', { hasText: 'Recent' }).click()
  assert(await page.locator('.parts-grid .part').first().textContent() === part, 'recent parts kept')
  pass(`${part} picked from the parts palette`)

  // Take parts from: 疑's tree by the keyboard, and the characters built from its parts.
  await page.locator('.ids-part').nth(1).click()
  await page.locator('.ids-part').nth(0).click()
  await page.getByRole('tab', { name: 'Take parts from' }).click()
  await page.locator('.from-field input').fill('疑')
  await page.locator('.from-row.sequence').first().waitFor()
  await page.locator('.from-field input').press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  const taken = await page.evaluate(() => document.activeElement?.querySelector('.from-take')?.textContent)
  await page.keyboard.press('Enter')
  assert(await value() === `⿰${taken}⿻七木`, `taken: ${await value()} (${taken})`)
  await page.locator('.from-hit').first().waitFor({ timeout: 20000 })
  const hit = await page.locator('.from-hit').first().textContent()
  await page.locator('.from-hit').first().click()
  await page.locator(`.from-row[data-key="x${hit}"]`).waitFor()
  pass(`${taken} taken from 疑's tree; ${hit} found by 疑's parts and opened`)

  // The preview: without its export, placeholders and no badge, since nothing could be tried; with
  // one, the filled part drawn and the empty slot a placeholder in its box.
  await page.goto(url)
  await page.locator('.ids-preview[data-step="unavailable"]').waitFor({ timeout: 15000 })
  assert(await page.locator('.ids-preview-large .slot').count() >= 3, 'placeholders stand for the parts')
  assert(await page.locator('.ids-preview-badge').count() === 0, 'no badge without data')
  await page.goto(`${url}?composer=${encodeURIComponent(`${url}composer/`)}&ids=${encodeURIComponent('⿰木⬚')}`)
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 15000 })
  await page.waitForFunction(() => document.querySelectorAll('.ids-preview-large .layer').length === 1)
  assert((await page.locator('.ids-preview-large .ink').getAttribute('d'))?.length > 20, 'the filled part is drawn')
  assert(await page.locator('.ids-preview-large .slot:not(.faint)').count() === 1, 'the empty slot is a placeholder')
  await page.locator('.ids-part.empty').click()
  assert(await page.locator('.ids-preview-large .slot.selected').count() === 1, 'the chosen slot is marked in the preview')
  await page.goto(`${url}?composer=${encodeURIComponent('http://[')}`)
  await page.locator('.ids-preview[data-step="unavailable"]').waitFor({ timeout: 15000 })
  pass('the preview degrades without its export or with a base that is no URL, and draws a part and an empty slot with one')

  assert(!errors.length, `page errors: ${errors.join('; ')}`)

  // Screenshots, light and dark, of a fresh page with the editor on 疑 and the tree open.
  for (const scheme of ['light', 'dark']) {
    const shot = await browser.newPage({ viewport: { width: 820, height: 1000 }, deviceScaleFactor: 2, colorScheme: scheme })
    await offline(shot)
    await shot.goto(url)
    await shot.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰𠤕⿱龴疋', null, { timeout: 15000 })
    await shot.locator('.ids-part').nth(1).click()
    await shot.getByRole('tab', { name: 'Take parts from' }).click()
    await shot.locator('.from-field input').fill('疑')
    await shot.locator('.from-hit').first().waitFor({ timeout: 20000 })
    await shot.evaluate(() => document.fonts.ready)
    await shot.screenshot({ path: join(shots, `demo-${scheme}.png`), fullPage: true })
    await shot.getByRole('tab', { name: 'Parts', exact: true }).click()
    await shot.locator('.parts-tabs [role="tab"]', { hasText: 'Hard to type' }).click()
    await shot.evaluate(() => document.fonts.ready)
    await shot.locator('.ids-input').screenshot({ path: join(shots, `palette-${scheme}.png`) })
    await shot.locator('.ids-operators').screenshot({ path: join(shots, `operators-${scheme}.png`) })
    const narrow = await browser.newPage({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    await offline(narrow)
    await narrow.goto(url)
    await narrow.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰𠤕⿱龴疋', null, { timeout: 15000 })
    assert(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width')
    await narrow.screenshot({ path: join(shots, `phone-${scheme}.png`), fullPage: true })
    // The preview beside the field: as it stands without its export, and drawn from the test export.
    await shot.goto(url)
    await shot.locator('.ids-preview[data-step="unavailable"]').waitFor({ timeout: 15000 })
    await shot.locator('.ids-top').screenshot({ path: join(shots, `preview-unavailable-${scheme}.png`) })
    await shot.goto(`${url}?composer=${encodeURIComponent(`${url}composer/`)}&ids=${encodeURIComponent('⿰木⿱口⬚')}`)
    await shot.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 15000 })
    await shot.waitForFunction(() => document.querySelectorAll('.ids-preview-large .layer').length === 1)
    await shot.locator('.ids-top').screenshot({ path: join(shots, `preview-composed-${scheme}.png`) })
    await Promise.all([shot.close(), narrow.close()])
  }
  pass(`screenshots in ${shots}/`)
} finally {
  await browser.close()
  server.stop(true)
}
