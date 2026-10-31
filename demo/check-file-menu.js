// The File menu: document actions, then Recent, the tab actions, sharing and export, and the draft
// actions, with Recent, Export and Browser drafts as submenus. A sequence opened in the workshop is
// remembered in Recent, which survives a reload. Run against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-file-menu.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { fromSequence, shareDocument } from '../src/document/index.js'

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
  // The export waits for the preview's drawing to arrive.
  const waitExport = async (button = item('Export')) => {
    for (let i = 0; i < 40 && await button.isDisabled(); i++) await page.waitForTimeout(250)
  }
  const openFile = async () => {
    await page.getByRole('menuitem', { name: 'File', exact: true }).click()
    await page.locator('.menu').waitFor()
  }
  const close = async () => {
    for (let i = 0; i < 3 && await page.locator('.menu').count(); i++) await page.keyboard.press('Escape')
    await page.locator('.menu').waitFor({ state: 'detached' })
  }
  const submenu = () => page.locator('.submenu [role="menuitem"]')

  // The top level groups documents, Recent, tab actions, sharing and drafts.
  await openFile()
  assert.equal(await item('Recent').isDisabled(), true, 'Recent starts empty')
  assert.equal(await item('Reopen closed tab').isDisabled(), true, 'nothing has been closed')
  assert.equal(await item('Browser drafts').isDisabled(), true, 'no drafts yet')
  const labels = await page.locator('.menu > [role="menuitem"]').evaluateAll(els => els.map(el => el.textContent.trim()))
  assert.deepEqual(labels.slice(0, 9), ['New sequence', 'Open document…', 'Save document…', 'Document title…', 'Recent', 'Reopen closed tab', 'Duplicate tab', 'Share', 'Export'], 'the File menu runs from documents through Recent and tabs to sharing')
  assert.match(labels[9], /^Keep draft in browser/, 'the draft action follows export')
  assert.equal(labels[10], 'Browser drafts', 'the drafts submenu ends the menu')
  await waitExport()
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

  // The right arrow opens the submenu on its first item; Escape closes the submenu first.
  await openFile()
  await item('Recent').focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'true', 'the right arrow opens the submenu')
  await page.waitForFunction(() => document.activeElement?.textContent?.includes('日木'))
  assert.match(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''), /日木/, 'the right arrow enters the submenu')
  await page.keyboard.press('ArrowRight')
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'true', 'the right arrow inside the submenu stays there')
  await page.keyboard.press('Escape')
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'false', 'Escape closes the submenu first')
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Recent', 'the submenu returns focus to its trigger')
  await page.keyboard.press('Escape')
  await page.locator('.menu').waitFor({ state: 'detached' })
  await openFile()
  await item('Recent').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'false', 'leaving the submenu closes it')
  await close()

  // Hovering another menu and coming back leaves the submenu closed.
  await openFile()
  await item('Recent').click()
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'File', exact: true }).hover()
  await page.waitForTimeout(150)
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'false', 'hovering another menu and back closes the submenu')
  await close()

  // Only one submenu is open at a time.
  await openFile()
  await item('Recent').click()
  await item('Export').click()
  assert.equal(await item('Recent').getAttribute('aria-expanded'), 'false', 'opening Export closes Recent')
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

  // A layer change replaces the recent document rather than leaving the version first opened.
  const document = fromSequence('⿱艹半')
  document.title = 'Recent document'
  const docPage = await context.newPage()
  const docErrors = []
  docPage.on('pageerror', error => docErrors.push(error.message))
  await docPage.goto(`${url}/?doc=${shareDocument(document)}#${encodeURIComponent('⿱艹半')}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await docPage.locator('.ids-field input').waitFor({ timeout: 120000 })
  const opened = await docPage.evaluate(() => JSON.parse(localStorage.getItem('ids-input:recent') ?? '[]').find(entry => entry.sequence === '⿱艹半'))
  assert.equal(opened?.document?.document?.title, 'Recent document', 'the link records its document in Recent')
  await docPage.getByRole('button', { name: 'Layers', exact: true }).click()
  const layerDialog = docPage.getByRole('dialog')
  await layerDialog.locator('img').waitFor({ timeout: 30000 })
  await layerDialog.getByRole('treeitem').nth(1).click()
  const xField = layerDialog.locator('input.num').first()
  await xField.fill('20')
  await xField.press('Tab')
  await docPage.waitForTimeout(600)
  const layerRecord = await docPage.evaluate(() => JSON.parse(localStorage.getItem('ids-input:recent') ?? '[]').find(entry => entry.sequence === '⿱艹半'))
  assert.equal(layerRecord?.document?.document?.title, 'Recent document', 'the recent keeps its document')
  const matrix = layerRecord?.document?.document?.root?.children?.[0]?.transform?.[0]?.matrix
  assert.equal(matrix?.[4], 20, 'a layer change keeps the recent document current')
  assert.deepEqual(docErrors, [])
  await docPage.close()

  // A malformed stored document falls back to its sequence.
  const broken = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await broken.addInitScript(() => {
    const tab = { id: 'bad', sequence: '⿰木口', saved: '⿰木口' }
    localStorage.setItem('ids-input:tabs', JSON.stringify([tab]))
    localStorage.setItem('ids-input:activeTab', JSON.stringify(tab.id))
    localStorage.setItem('ids-input:recent', JSON.stringify([{ sequence: '⿰木口', document: { document: 'nope' } }]))
  })
  const brokenPage = await broken.newPage()
  const brokenErrors = []
  brokenPage.on('pageerror', error => brokenErrors.push(error.message))
  await brokenPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await brokenPage.locator('.ids-field input').waitFor({ timeout: 120000 })
  await brokenPage.getByRole('menuitem', { name: 'File', exact: true }).click()
  await brokenPage.getByRole('menuitem', { name: 'Recent', exact: true }).click()
  await brokenPage.getByRole('menuitem', { name: '⿰木口', exact: true }).click()
  assert.equal(await brokenPage.getByRole('tab', { name: '⿰木口', exact: true }).getAttribute('aria-selected'), 'true', 'a malformed recent document still opens its sequence')
  assert.deepEqual(brokenErrors, [])
  await broken.close()

  assert.deepEqual(errors, [])

  // The phone sheet carries the same submenus; a reopened sheet starts with them closed.
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const many = ['ⱱ日木', ...Array.from({ length: 13 }, (_, i) => `recent-${i}`), 'recent-0']
  await phone.addInitScript(({ tabs, recent, drafts }) => {
    localStorage.setItem('ids-input:tabs', JSON.stringify(tabs))
    localStorage.setItem('ids-input:activeTab', JSON.stringify(tabs[1].id))
    localStorage.setItem('ids-input:recent', JSON.stringify(recent))
    localStorage.setItem('ids-input:drafts', JSON.stringify(drafts))
  }, { tabs: records, recent: many, drafts: [{ id: 'phone-draft', sequence: 'ⱱ日木', saved: Date.now() }] })
  const small = await phone.newPage()
  const phoneErrors = []
  small.on('pageerror', error => phoneErrors.push(error.message))
  await small.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await small.locator('.ids-field input').waitFor({ timeout: 120000 })
  await small.getByRole('button', { name: 'Menu', exact: true }).click()
  const sheet = small.locator('dialog[open]')
  await sheet.waitFor()
  await sheet.getByRole('button', { name: 'Recent', exact: true }).click()
  assert.equal(await sheet.getByText('ⱱ日木', { exact: true }).count(), 1, 'the phone File section opens Recent')
  assert.equal(await sheet.locator('.submenu .item').count(), 12, 'Recent keeps twelve distinct entries')
  await waitExport(sheet.getByRole('button', { name: 'Export', exact: true }))
  await sheet.getByRole('button', { name: 'Export', exact: true }).click()
  assert.deepEqual(await sheet.locator('.submenu .item').allInnerTexts(), ['SVG', 'PNG'], 'the phone Export submenu offers both formats')
  assert.equal(await sheet.getByRole('button', { name: 'Recent', exact: true }).getAttribute('aria-expanded'), 'false', 'one submenu is open at a time on the phone')
  await sheet.getByRole('button', { name: 'Browser drafts', exact: true }).click()
  assert.equal(await sheet.locator('.submenu .item').filter({ hasText: 'Remove' }).count(), 1, 'the phone drafts submenu can remove its draft')
  await small.keyboard.press('Escape')
  await small.locator('dialog[open]').waitFor({ state: 'detached' })
  await small.getByRole('button', { name: 'Menu', exact: true }).click()
  const reopened = small.locator('dialog[open]')
  await reopened.waitFor()
  assert.equal(await reopened.getByRole('button', { name: 'Recent', exact: true }).getAttribute('aria-expanded'), 'false', 'the phone sheet reopens with its submenus closed')
  assert.equal(await reopened.locator('.submenu').count(), 0, 'no phone submenu survives the sheet closing')
  assert.deepEqual(phoneErrors, [])
  await phone.close()

  console.log('PASS the File menu groups its actions and opens Recent, Export and drafts as submenus')
} finally { await browser.close() }
