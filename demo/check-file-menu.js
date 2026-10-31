// The File menu: document actions, then Recent, the tab actions, sharing and export, and the draft
// actions, with Recent, Export and Browser drafts as submenus. A sequence opened in the workshop is
// remembered in Recent, which survives a reload. Run against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-file-menu.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const records = ['⿾正', '⿰氵恩', '⿱艹半', '⿻大㸚'].map((sequence, i) => ({ id: `tab-${i}`, sequence, saved: sequence }))
  await context.addInitScript(({ tabs }) => {
    localStorage.setItem('ids-input:tabs', JSON.stringify(tabs))
    localStorage.setItem('ids-input:activeTab', JSON.stringify(tabs[1].id))
  }, { tabs: records })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })

  const item = name => page.getByRole('menuitem', { name, exact: true })
  const openFile = async () => {
    await page.getByRole('menuitem', { name: 'File', exact: true }).click()
    await page.locator('.menu').waitFor()
  }
  const close = () => page.keyboard.press('Escape')
  const submenu = () => page.locator('.submenu [role="menuitem"]')

  // The top level groups documents, Recent, tab actions, sharing and drafts.
  await openFile()
  assert.equal(await item('Recent').isDisabled(), true, 'Recent starts empty')
  assert.equal(await item('Reopen closed tab').isDisabled(), true, 'nothing has been closed')
  assert.equal(await item('Browser drafts').isDisabled(), true, 'no drafts yet')
  const labels = await page.locator('.menu > [role="menuitem"]').evaluateAll(els => els.map(el => el.textContent.trim()))
  assert.deepEqual(labels.slice(0, 8), ['New sequence', 'Open document…', 'Save document…', 'Recent', 'Reopen closed tab', 'Duplicate tab', 'Share', 'Export'], 'the File menu runs from documents through Recent and tabs to sharing')
  assert.match(labels[8], /^Keep draft in browser/, 'the draft action follows export')
  assert.equal(labels[9], 'Browser drafts', 'the drafts submenu ends the menu')
  await item('Export').click()
  assert.deepEqual(await submenu().allInnerTexts(), ['SVG', 'PNG'], 'Export opens its formats')
  await close()

  // A linked sequence is remembered, survives a reload, and can be reopened from Recent.
  await page.goto(`${url}#${encodeURIComponent('⿱日木')}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })
  assert.equal(await page.locator('.ids-field input').inputValue(), '⿱日木', 'the link opened its sequence')
  const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:recent') ?? '[]'))
  assert.equal(remembered[0]?.sequence, '⿱日木', 'opening a sequence remembers it first')
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('.ids-field input').waitFor({ timeout: 120000 })
  await openFile()
  assert.equal(await item('Recent').isDisabled(), false, 'Recent remembers the sequence after a reload')
  await item('Recent').click()
  assert.equal((await submenu().allInnerTexts())[0], '⿱日木', 'the recent list shows the sequence')
  await close()

  // Closing the sequence and picking it from Recent opens it again.
  const tab = page.locator('.tab', { has: page.getByRole('tab', { name: '⿱日木', exact: true }) })
  await tab.click({ button: 'right' })
  await item('Close tab').click()
  assert.equal(await page.getByRole('tab', { name: '⿱日木', exact: true }).count(), 0, 'the sequence tab is closed')
  await openFile()
  await item('Recent').click()
  await item('⿱日木').click()
  assert.equal(await page.getByRole('tab', { name: '⿱日木', exact: true }).getAttribute('aria-selected'), 'true', 'Recent opens and shows the sequence')
  await close()

  // The Recent submenu opens with the right arrow, walks its items and closes with the left.
  await openFile()
  await item('Recent').focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'true', 'the right arrow opens the submenu')
  await page.keyboard.press('ArrowDown')
  assert.match(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''), /日木/, 'the down arrow enters the submenu')
  await page.keyboard.press('ArrowLeft')
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Recent', 'the left arrow closes the submenu')
  await close()

  // Saving the open sequence gives the drafts submenu its item.
  await page.keyboard.press('Control+s')
  await openFile()
  assert.equal(await item('Browser drafts').isDisabled(), false, 'a saved draft enables the drafts submenu')
  await item('Browser drafts').click()
  const drafts = await submenu().allInnerTexts()
  assert.equal(drafts[0], '⿱日木', 'the drafts submenu lists the saved sequence')
  assert.match(drafts.at(-1) ?? '', /^Remove/, 'the drafts submenu can remove it')
  await close()

  assert.deepEqual(errors, [])

  // The phone sheet shows the same submenus in its File section.
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await phone.addInitScript(({ tabs }) => {
    localStorage.setItem('ids-input:tabs', JSON.stringify(tabs))
    localStorage.setItem('ids-input:activeTab', JSON.stringify(tabs[1].id))
    localStorage.setItem('ids-input:recent', JSON.stringify(['⿱日木']))
  }, { tabs: records })
  const small = await phone.newPage()
  await small.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await small.locator('.ids-field input').waitFor({ timeout: 120000 })
  await small.getByRole('button', { name: 'Menu', exact: true }).click()
  const sheet = small.locator('dialog[open]')
  await sheet.waitFor()
  await sheet.getByRole('button', { name: 'Recent', exact: true }).click()
  assert.equal(await sheet.getByText('⿱日木', { exact: true }).count(), 1, 'the phone File section opens Recent')
  await phone.close()

  console.log('PASS the File menu groups its actions and opens Recent, Export and drafts as submenus')
} finally { await browser.close() }
