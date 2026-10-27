#!/usr/bin/env bun
// The built workshop (dist/) in a headless Chromium: editing by keyboard, pointer, drag and the tree's
// context menu, named undo and redo, the pickers, the preview with and without its export, the
// output and export, drafts, tabs, sharing, the theme switch, preferences and languages, then
// screenshots at 2x in light and dark through the theme switch, at desktop, tablet and phone widths.
//
//   bun run build:demo && devrun bun demo/check-seal-review-runner.js [--shots DIR] [--chromium PATH]
import { EXAMPLES } from './lib/examples.js'
import { COMPOSER_BASE } from './lib/composer.js'
import { checkSealReview } from './check-seal-review.js'
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { files as composerFiles } from '../tests/fixtures/composer-export.js'

const UNENCODED = EXAMPLES.filter(example => !example.char).length

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
async function open(path = '', { width = 1440, height = 900, scheme = 'light', locale } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme, ...(locale ? { locale } : {}), acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  await context.route('https://glyphatlas.org/**', route => route.abort())
  const page = await context.newPage()
  page.errors = []
  page.composerRequests = []
  context.on('request', request => {
    if (request.url().startsWith(COMPOSER_BASE.replace(/\/$/, ''))) page.composerRequests.push(request.url())
  })
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
  await checkSealReview({ open, shots, assert, pass })
} finally {
  await browser.close()
  server.stop(true)
}
