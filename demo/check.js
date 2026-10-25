#!/usr/bin/env bun
// The built workshop (dist/) in a headless Chromium: editing by keyboard, pointer, drag and the tree's
// context menu, named undo and redo, the pickers, the preview with and without its export, the
// output and export, drafts, sharing, the theme switch, preferences and languages, then screenshots
// at 2x in light and dark through the theme switch, at desktop, tablet and phone widths.
//
//   bun run build:demo && bun demo/check.js [--shots DIR] [--chromium PATH]
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { files as composerFiles } from '../tests/fixtures/composer-export.js'

const arg = name => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : undefined }
const shots = arg('--shots') ?? 'shots'
const executablePath = arg('--chromium') ?? process.env.CHROMIUM_PATH
mkdirSync(shots, { recursive: true })
const root = join(import.meta.dirname, '..', 'dist')
// The small export of the composer tests, served beside the workshop for the preview to draw from.
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
const fixture = `?composer=${encodeURIComponent(`${url}composer/`)}`
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const pass = message => console.log('PASS', message)
const browser = await chromium.launch({ executablePath })
/** A fresh page; the real export is another site's, so the check never reaches it. */
async function open(path = '', { width = 1440, height = 900, scheme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  await context.route('https://glyphatlas.org/**', route => route.abort())
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', error => page.errors.push(error.message))
  await page.goto(url + path)
  await page.locator('.ids-field input').waitFor()
  return page
}
const valueOf = page => page.locator('.ids-field input').inputValue()
/** Choose the nth part of the tree; a click on the chosen part lets it go, so it is clicked again then. */
async function choose(page, n) {
  const part = page.locator('.ids-part').nth(n)
  await part.click()
  if (await part.getAttribute('aria-pressed') !== 'true') await part.click()
}

try {
  const page = await open()
  const value = () => valueOf(page)
  await page.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰𠤕⿱龴疋', null, { timeout: 15000 })
  await page.locator('.seq-row .char').first().waitFor({ timeout: 15000 })
  assert((await page.locator('.seq-row .char').first().textContent()).startsWith('疑'), 'the output names the character it encodes')
  pass('the workshop opens on 疑, matched to its character')

  // Operators in three groups with their keys.
  const groups = await page.locator('.ids-op-group').evaluateAll(els => els.map(el => [el.querySelector('.ids-op-label').textContent, el.querySelectorAll('.ids-key').length]))
  assert(JSON.stringify(groups) === JSON.stringify([['1 part', 3], ['3 parts', 2], ['2 parts', 13]]), `groups: ${JSON.stringify(groups)}`)
  assert(await page.locator('.ids-key[data-op="⿾"] .ids-kbd').textContent() === 'E', 'each operator shows its key')
  pass('operators grouped by their parts, keys shown')

  // Typed with ASCII names; an empty slot is named.
  await page.locator('.ids-field input').fill('')
  await page.locator('.ids-field input').pressSequentially('LR亻')
  assert(await value() === '⿰亻', `typed: ${await value()}`)
  assert((await page.locator('.status').textContent())?.includes('2'), 'the empty slot is named')
  pass('ASCII names are read as operators, and an empty slot is named')

  // The slot chosen, 2 splits it, parts typed fill it.
  await page.locator('.ids-part.empty').click()
  await page.keyboard.press('Digit2')
  assert(await value() === '⿰亻⿱＋＋', `split: ${await value()}`)
  await page.locator('input.ids-slot').fill('七')
  await page.locator('input.ids-slot').press('Enter')
  await page.locator('input.ids-slot').fill('木')
  await page.locator('input.ids-slot').press('Enter')
  assert(await value() === '⿰亻⿱七木', `filled: ${await value()}`)
  assert((await page.locator('button[aria-label^="Undo"]').getAttribute('title')) === 'Undo: Put 木', 'Undo names its step')
  pass('operator keys split a slot, parts typed fill the slots, Undo names the step')

  // Tab steps through the parts; a letter typed on the tree goes to the part field; Backspace empties,
  // with an Undo note.
  await page.locator('.ids-op').first().focus()
  await page.keyboard.press('Tab')
  assert(await page.evaluate(() => document.activeElement?.dataset.path) === '0', 'Tab reaches the first part')
  await page.keyboard.press('Shift+Tab')
  assert(await page.evaluate(() => document.activeElement?.dataset.path) === '', 'Shift+Tab steps back')
  await page.keyboard.press('Tab')
  await page.keyboard.press('KeyK')
  assert(await page.locator('input.ids-slot').inputValue() === 'k', 'a typed letter goes to the part field')
  await page.locator('.ids-part').first().focus()
  await page.keyboard.press('Backspace')
  assert(await value() === '⿰＋⿱七木', `cleared: ${await value()}`)
  await page.locator('.toast button').click()
  assert(await value() === '⿰亻⿱七木', `undone from the note: ${await value()}`)
  pass('Tab and Shift+Tab, typing on the tree, Backspace with an Undo note')

  // An operator on a node swaps it, refusing to drop a filled part; × takes a level away; undo, redo.
  await page.locator('.ids-op').nth(1).click()
  await page.keyboard.press('Equal')
  assert(await value() === '⿰亻⿻七木', `swap: ${await value()}`)
  await page.keyboard.press('KeyE')
  assert(await value() === '⿰亻⿻七木' && (await page.locator('.status.fault').textContent()).length > 0, 'a swap dropping a part is refused')
  await page.locator('.ids-unwrap').nth(1).click()
  assert(await value() === '⿰亻七', `unwrap: ${await value()}`)
  await page.locator('.ids-op').first().focus()
  await page.keyboard.press('Control+z')
  assert(await value() === '⿰亻⿻七木', `undo: ${await value()}`)
  await page.keyboard.press('Control+Shift+z')
  assert(await value() === '⿰亻七', `redo: ${await value()}`)
  await page.locator('button[aria-label^="Undo"]').click()
  assert(await value() === '⿰亻⿻七木', `undo by the toolbar: ${await value()}`)
  pass('swaps, refusals, × and undo and redo by key and toolbar')

  // The history lists each step by name, and jumps.
  await page.getByRole('button', { name: 'History' }).click()
  const steps = await page.locator('[role="menu"] .item .label').allTextContents()
  assert(steps.includes('Change ⿱ to ⿻') && steps.includes('Remove ⿻'), `history: ${steps.join(' | ')}`)
  await page.locator('[role="menu"] .item', { hasText: 'Type ⿰亻' }).click()
  assert(await value() === '⿰亻＋', `jumped: ${await value()}`)
  pass('the history names every step and jumps to one')

  // The tree's context menu: split with an operator, copy the part's sequence.
  await page.locator('.ids-field input').fill('⿰亻木')
  await page.locator('.ids-part').nth(1).click({ button: 'right' })
  await page.locator('.ids-menu').waitFor()
  await page.locator('.ids-menu .ids-menu-op[aria-label="Above to below"]').click()
  assert(await value() === '⿰亻⿱木＋', `split from the menu: ${await value()}`)
  await page.locator('.ids-op').nth(1).focus()
  await page.keyboard.press('Shift+F10')
  await page.locator('.ids-menu .ids-menu-item', { hasText: 'Copy' }).click()
  assert(await page.evaluate(() => navigator.clipboard.readText()) === '⿱木＋', 'the part\'s sequence is copied')
  pass('the context menu splits a part and copies its sequence')

  // The parts palette: a part dragged onto a slot, and one picked into the chosen slot.
  await page.locator('.parts-grid .part').first().waitFor()
  const first = await page.locator('.parts-grid .part').first().textContent()
  await page.locator('.parts-grid .part').first().dragTo(page.locator('.ids-part.empty'))
  assert(await value() === `⿰亻⿱木${first}`, `dropped: ${await value()}`)
  await choose(page, 0)
  await page.locator('.parts-tabs [role="tab"]', { hasText: 'Hard to type' }).click()
  const part = await page.locator('.parts-grid .part').first().textContent()
  await page.locator('.parts-grid .part').first().click()
  assert(await value() === `⿰${part}⿱木${first}`, `palette: ${await value()}`)
  pass(`${first} dragged onto a slot, ${part} picked from the palette`)

  // Take parts from: a character dropped on the panel, then a part of its tree taken by the keyboard.
  await page.getByRole('tab', { name: 'Take parts from' }).click()
  await page.locator('.ids-from').evaluate(el => {
    const data = new DataTransfer(); data.setData('text/plain', '疑')
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }))
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
  })
  assert(await page.locator('.from-field input').inputValue() === '疑', 'a dropped character is read')
  await page.locator('.from-row.sequence').first().waitFor()
  await choose(page, 0)
  await page.locator('.from-field input').press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  const taken = await page.evaluate(() => document.activeElement?.querySelector('.from-take')?.textContent)
  await page.keyboard.press('Enter')
  assert((await value()).startsWith(`⿰${taken}`), `taken: ${await value()} (${taken})`)
  pass(`疑 dropped on Take parts from, ${taken} taken from its tree`)

  // Find: a component by its code point.
  await page.getByRole('tab', { name: 'Find' }).click()
  await choose(page, 0)
  await page.locator('.ids-find input').fill('U+6728')
  await page.locator('.ids-hit').first().click()
  assert((await value()).startsWith('⿰木'), `found: ${await value()}`)
  pass('a component found by its code point replaces the chosen part')

  // The preview without its export: placeholders and no badge, since nothing could be tried.
  await page.locator('.ids-preview[data-step="unavailable"]').waitFor({ timeout: 15000 })
  assert(await page.locator('.ids-preview-large .slot').count() >= 2, 'placeholders stand for the parts')
  assert(await page.locator('.ids-preview-badge').count() === 0, 'no badge without data')
  assert(await page.locator('.export .primary').isDisabled(), 'nothing to export')
  const bad = await open(`?composer=${encodeURIComponent('http://[')}`)
  await bad.locator('.ids-preview[data-step="unavailable"]').waitFor({ timeout: 15000 })
  await bad.context().close()
  pass('the preview degrades without its export, or with a base that is no URL')
  assert(!page.errors.length, `page errors: ${page.errors.join('; ')}`)

  // With an export: the filled part drawn, the slot a placeholder; SVG and PNG saved as files named
  // after the sequence, on the background and in the ink chosen; the settings kept.
  const drawn = await open(`${fixture}#${encodeURIComponent('⿰木＋')}`)
  await drawn.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 15000 })
  await drawn.waitForFunction(() => document.querySelectorAll('.ids-preview-large .layer').length === 1)
  assert((await drawn.locator('.ids-preview-large .ink').getAttribute('d'))?.length > 20, 'the filled part is drawn')
  assert(await drawn.locator('.ids-preview-large .slot:not(.faint)').count() === 1, 'the empty slot is a placeholder')
  await drawn.locator('.swatch.black').click()
  const [svg] = await Promise.all([drawn.waitForEvent('download'), drawn.locator('.export .primary').click()])
  assert(svg.suggestedFilename() === '⿰木＋.svg', `file: ${svg.suggestedFilename()}`)
  const text = readFileSync(await svg.path(), 'utf8')
  assert(text.includes('fill="#000000"/>') && text.includes('fill="#ffffff"') && !text.includes('stroke-dasharray'), 'white ink on black, no placeholders')
  await drawn.locator('.export [role="radio"]', { hasText: 'PNG' }).click()
  const [png] = await Promise.all([drawn.waitForEvent('download'), drawn.locator('.export .primary').click()])
  const bytes = readFileSync(await png.path())
  assert(png.suggestedFilename() === '⿰木＋.png' && bytes[1] === 0x50 && bytes.readUInt32BE(16) === 1024, 'a 1024 px PNG')
  await drawn.reload()
  await drawn.locator('.export').waitFor()
  assert(await drawn.locator('.swatch.black').getAttribute('aria-checked') === 'true', 'export settings kept')
  pass('the preview draws from an export; SVG and PNG saved with background, ink and name; settings kept')

  // Drafts saved with the keyboard and reopened; a link and its QR code; the About sources.
  await drawn.locator('.ids-tree').click({ position: { x: 4, y: 4 } })
  await drawn.keyboard.press('Control+s')
  await drawn.locator('.ids-field input').fill('⿱木木')
  await drawn.getByRole('button', { name: 'Drafts' }).click()
  const labels = await drawn.locator('[role="menu"] .item .label').allTextContents()
  await drawn.locator('[role="menu"] .item').nth(labels.indexOf('⿰木＋')).click()
  assert(await valueOf(drawn) === '⿰木＋', 'a saved draft reopens')
  assert(new URL(drawn.url()).hash === `#${encodeURIComponent('⿰木＋')}`, 'the address carries the sequence')
  await drawn.getByRole('button', { name: 'Share' }).click()
  assert((await drawn.locator('.share input').inputValue()).endsWith(`#${encodeURIComponent('⿰木＋')}`), 'the share link opens the sequence')
  assert((await drawn.locator('.share .qr path').getAttribute('d')).length > 100, 'a QR code')
  await drawn.keyboard.press('Escape')
  await drawn.getByRole('button', { name: 'About' }).click()
  const inspired = await drawn.locator('.about li a').allTextContents()
  assert(['字統网 zi.tools', '字海网 yedict', 'Mojidata IDS Finder', 'CHISE IDS 漢字検索', 'BabelStone IDS', 'han-compose'].every(name => inspired.includes(name)), `about: ${inspired.join(', ')}`)
  await drawn.keyboard.press('Escape')
  pass('drafts, the share link and QR code, and the sources and inspirations')

  // The theme switch sets data-theme, kept and applied before the page paints; key hints can be hidden;
  // the language changes the whole page.
  await drawn.locator('.bar').getByRole('radio', { name: 'Dark' }).click()
  assert(await drawn.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark set')
  await drawn.reload({ waitUntil: 'commit' })
  await drawn.waitForFunction(() => document.body !== null)
  assert(await drawn.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark before the page script runs')
  await drawn.locator('.ids-field input').waitFor()
  await drawn.locator('.bar').getByRole('radio', { name: 'System theme' }).click()
  assert(await drawn.evaluate(() => document.documentElement.dataset.theme === undefined && localStorage.getItem('ids-input:theme') === null), 'system theme clears it')
  await drawn.getByRole('button', { name: 'Preferences' }).click()
  await drawn.locator('.prefs input[type="checkbox"]').click()
  await drawn.keyboard.press('Escape')
  assert(await drawn.locator('.ids-kbd').count() === 0, 'key hints hidden')
  await drawn.locator('.bar select.locale').selectOption('ja')
  assert(await drawn.locator('.brand span').textContent() === 'IDS工房' && await drawn.locator('.ids-op-label').first().textContent() === '1部品', 'Japanese throughout')
  pass('theme switch, no flash, key hints off, the language')
  assert(!drawn.errors.length, `page errors: ${drawn.errors.join('; ')}`)

  // IdsInput as one block in a host page: it starts from 疑, takes operator keys and hands a whole sequence over.
  const embed = await open('embed.html')
  await embed.waitForFunction(() => document.querySelector('.ids-field input')?.value === '⿰𠤕⿱龴疋', null, { timeout: 15000 })
  await choose(embed, 0)
  await embed.keyboard.press('Digit1')
  assert(await valueOf(embed) === '⿰⿰𠤕＋⿱龴疋', `embedded split: ${await valueOf(embed)}`)
  await embed.keyboard.press('Control+z')
  await embed.locator('.ids-use').click()
  assert(await embed.locator('.used').textContent() === '⿰𠤕⿱龴疋', 'the whole sequence is handed over')
  assert(!embed.errors.length, `page errors: ${embed.errors.join('; ')}`)
  await embed.screenshot({ path: join(shots, 'embed.png'), fullPage: true })
  await embed.context().close()
  pass('IdsInput embedded: keys, undo and Use')

  // On a phone: a top bar of undo, redo and one menu, which holds the rest.
  const phone = await open('', { width: 375, height: 812 })
  assert(await phone.locator('.bar .locale').isHidden() && await phone.locator('.bar .more').isVisible(), 'the phone bar is compact')
  await phone.locator('.bar .more').click()
  await phone.locator('dialog[open] .more-sheet').waitFor()
  await phone.locator('dialog[open] .item', { hasText: 'About' }).click()
  await phone.locator('dialog[open] .about').waitFor()
  await phone.keyboard.press('Escape')
  await phone.context().close()
  pass('the phone bar: undo, redo and a menu sheet holding the rest')

  // Screenshots, light and dark through the theme switch, at three widths; no sideways scroll. The
  // phone is shot at the top, the middle and the foot of the page, the bar staying at the top.
  for (const scheme of ['light', 'dark']) for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 1024, 1200], ['phone', 375, 812]]) {
    const shot = await open('#' + encodeURIComponent('⿰𠤕⿱龴疋'), { width, height })
    if (name === 'phone') {
      await shot.locator('.bar .more').click()
      await shot.locator('dialog[open]').getByRole('radio', { name: scheme === 'dark' ? 'Dark' : 'Light' }).click()
      if (scheme === 'dark') await shot.locator('dialog[open]').screenshot({ path: join(shots, 'phone-menu-dark.png') })
      else await shot.locator('dialog[open]').screenshot({ path: join(shots, 'phone-menu-light.png') })
      await shot.keyboard.press('Escape')
    } else await shot.locator('.bar').getByRole('radio', { name: scheme === 'dark' ? 'Dark' : 'Light' }).click()
    await shot.locator('.ids-part').nth(1).click()
    await shot.locator('.ids-preview[data-step="unavailable"]').waitFor({ timeout: 15000 })
    await shot.evaluate(() => document.fonts.ready)
    assert(await shot.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at ${width}`)
    if (name === 'phone') {
      for (const [at, where] of [[0, 'top'], [0.5, 'middle'], [1, 'foot']]) {
        await shot.evaluate(share => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * share), at)
        await shot.waitForTimeout(150)
        const top = await shot.locator('.bar').evaluate(el => el.getBoundingClientRect().top)
        assert(top === 0, `the bar stays at the top when scrolled to the ${where} (${top})`)
        await shot.screenshot({ path: join(shots, `phone-${where}-${scheme}.png`) })
      }
    } else await shot.screenshot({ path: join(shots, `${name}-${scheme}.png`), fullPage: name !== 'desktop' })
    if (name === 'desktop') {
      await shot.locator('.ids-part').nth(1).click({ button: 'right' })
      await shot.locator('.ids-menu').screenshot({ path: join(shots, `menu-${scheme}.png`) })
      await shot.keyboard.press('Escape')
      await shot.goto(`${url}${fixture}#${encodeURIComponent('⿰木⿱口＋')}`)
      await shot.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 15000 })
      await shot.waitForTimeout(300)
      await shot.locator('.output').screenshot({ path: join(shots, `output-${scheme}.png`) })
      await shot.getByRole('button', { name: 'About' }).click()
      await shot.locator('dialog[open]').screenshot({ path: join(shots, `about-${scheme}.png`) })
    }
    await shot.context().close()
  }
  pass(`screenshots in ${shots}/`)
} finally {
  await browser.close()
  server.stop(true)
}
