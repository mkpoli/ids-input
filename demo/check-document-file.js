// Run against a local devrun server with IDS_URL and optional IDS_FILE_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { readFileSync, writeFileSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  if (process.env.IDS_FILE_SHOTS) await page.getByRole('menu').screenshot({ path: `${process.env.IDS_FILE_SHOTS}/file-menu.png` }).catch(() => {})
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Save document…', exact: true }).click(),
  ]).then(([d]) => d)
  const path = await download.path()
  assert.ok(path, 'download path')
  const saved = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(saved.format, 'ids-input/document')
  assert.equal(saved.version, 1)
  saved.title = 'Opened document'
  writeFileSync('/tmp/opened.ids.json', JSON.stringify(saved))
  const before = await page.locator('.tabbar [role="tab"]').count()
  await page.locator('input[type=file]').setInputFiles('/tmp/opened.ids.json')
  await page.waitForTimeout(800)
  assert.equal(await page.locator('.tabbar [role="tab"]').count(), before + 1)
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]').at(-1))
  assert.equal(record?.document?.document?.title, 'Opened document')
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  const svgWait = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export SVG', exact: true }).click()
  const svgDownload = await svgWait
  const svgPath = await svgDownload.path()
  assert.ok(svgPath, 'SVG download path')
  const svg = readFileSync(svgPath, 'utf8')
  assert.ok(svg.includes('id="ids-input-document"'), 'the SVG carries the document')
  writeFileSync('/tmp/opened.svg', svg)
  const beforeSvg = await page.locator('.tabbar [role="tab"]').count()
  await page.locator('input[type=file]').setInputFiles('/tmp/opened.svg')
  await page.waitForTimeout(800)
  assert.equal(await page.locator('.tabbar [role="tab"]').count(), beforeSvg + 1)
  const svgRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]').at(-1))
  assert.equal(svgRecord?.document?.document?.format, 'ids-input/document')
  assert.deepEqual(errors, [])
  console.log('PASS document download, save and open; SVG export reopens with its document')
} finally { await browser.close() }
