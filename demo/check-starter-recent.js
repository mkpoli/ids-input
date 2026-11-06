// The starter dialog's Recently closed tab: the chevron beside the tab strip's + lists each tab
// closed this session as its own row, newest first, with its drawing. Choosing a row brings that tab
// back in its old place, shows it and puts the focus on it. A group close leaves one row per tab,
// and rows reopened in any order still end in the old order. The list is empty on arrival and after
// every close has been reopened. Run against a devrun server:
//   IDS_URL=http://localhost:5198 CHROMIUM_PATH=/path/to/chrome bun demo/check-starter-recent.js
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

  const order = () => page.locator('.tabbar .tab').evaluateAll(els => els.map(el => /** @type {HTMLElement} */ (el).dataset.tabId))
  const active = () => page.locator('.tabbar .tab.on').getAttribute('data-tab-id')
  const panel = page.locator('.starter-panel')
  const openStarter = async () => {
    await page.locator('.starter-trigger').click()
    await panel.waitFor()
    await panel.getByRole('tab', { name: 'Recently closed', exact: true }).click()
  }
  const closeStarter = async () => {
    await page.keyboard.press('Escape')
    await panel.waitFor({ state: 'detached' })
  }
  const entries = () => panel.locator('.starter-recent-item')
  const names = () => entries().evaluateAll(els => els.map(el => /** @type {HTMLElement} */ (el.querySelector('.starter-recent-name')).textContent))
  const thumbs = () => entries().evaluateAll(els => els.map(el => el.querySelectorAll('.starter-recent-thumb').length))
  const closeTab = async id => {
    await page.locator(`.tab[data-tab-id="${id}"] [role="tab"]`).click({ button: 'middle' })
  }
  const focusedTab = () => page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.closest('.tab')?.getAttribute('data-tab-id'))

  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'four tabs open')
  assert.equal(await active(), 'tab-1', 'the second tab is shown')

  // The starter offers the list from the first visit, with nothing in it.
  await openStarter()
  assert.equal(await entries().count(), 0, 'nothing is closed yet')
  assert.equal(await panel.locator('.starter-recent-empty').innerText(), 'Tabs you close appear here.', 'the empty list says where closed tabs go')
  // The arrows walk all three tabs, and Home and End reach the ends.
  const selected = () => panel.locator('.starter-tab[aria-selected="true"]').innerText()
  await page.keyboard.press('ArrowLeft')
  assert.equal(await selected(), 'Examples', 'ArrowLeft steps back from the last tab')
  await page.keyboard.press('ArrowLeft')
  assert.equal(await selected(), 'Templates', 'ArrowLeft reaches the first tab')
  await page.keyboard.press('ArrowLeft')
  assert.equal(await selected(), 'Recently closed', 'the tabs wrap')
  await page.keyboard.press('Home')
  assert.equal(await selected(), 'Templates', 'Home goes to the first tab')
  await page.keyboard.press('End')
  assert.equal(await selected(), 'Recently closed', 'End goes to the last tab')
  await closeStarter()

  // A closed tab is listed by its sequence, newest first.
  await closeTab('tab-0')
  assert.deepEqual(await order(), ['tab-1', 'tab-2', 'tab-3'], 'the first tab is closed')
  await closeTab('tab-2')
  assert.deepEqual(await order(), ['tab-1', 'tab-3'], 'a later close comes first in the history')
  await openStarter()
  assert.deepEqual(await names(), ['⿱艹半', '⿾正'], 'the list names the closed tabs, newest first')
  assert.deepEqual(await thumbs(), [1, 1], 'each row shows one thumbnail')
  await entries().first().locator('.starter-recent-thumb .tab-glyph').waitFor({ timeout: 30000 })

  // Choosing the newer entry reopens it in its old place and puts the focus on it.
  await entries().first().click()
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(await order(), ['tab-1', 'tab-2', 'tab-3'], 'the closed tab comes back before the tab that followed it')
  assert.equal(await active(), 'tab-2', 'the reopened tab is shown')
  assert.equal(await focusedTab(), 'tab-2', 'the reopened tab takes the focus')
  assert.equal(await page.locator('.toast').filter({ hasText: /Closed/ }).count(), 0, 'reopening takes the close note away')
  await openStarter()
  assert.deepEqual(await names(), ['⿾正'], 'the reopened tab leaves the list')
  await entries().first().click()
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'the older tab comes back in the first place')
  assert.equal(await active(), 'tab-0', 'the reopened tab is shown')
  await openStarter()
  assert.equal(await entries().count(), 0, 'the list is empty again')
  await closeStarter()

  // Closing several tabs lists each of them; reopening rows out of order still restores the old order.
  await page.locator('.tab[data-tab-id="tab-1"] [role="tab"]').click()
  await page.locator('.tab[data-tab-id="tab-3"] [role="tab"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Close all tabs', exact: true }).click()
  await page.locator('dialog[open]').getByRole('button', { name: 'Close all', exact: true }).click()
  assert.equal((await order()).length, 1, 'the group close leaves one empty tab')
  await openStarter()
  assert.deepEqual(await names(), ['⿾正', '⿰氵恩', '⿱艹半', '⿻大㸚'], 'the close lists one row for each tab')
  assert.deepEqual(await thumbs(), [1, 1, 1, 1], 'each of those rows shows one thumbnail')
  await entries().first().locator('.starter-recent-thumb .tab-glyph').waitFor({ timeout: 30000 })
  await entries().nth(2).click()
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(await order(), ['tab-2'], 'the chosen tab comes back and takes the empty tab away')
  assert.equal(await page.locator('.ids-field input').inputValue(), '⿱艹半', 'the chosen tab is shown')
  await openStarter()
  assert.deepEqual(await names(), ['⿾正', '⿰氵恩', '⿻大㸚'], 'the rest of the group stays listed')
  await entries().first().click()
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(await order(), ['tab-0', 'tab-2'], 'a tab restored later goes before its open neighbour')
  await openStarter()
  await entries().last().click()
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(await order(), ['tab-0', 'tab-2', 'tab-3'], 'the last tab goes after its open neighbour')
  await openStarter()
  await entries().first().click()
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'the old order returns')
  assert.equal(await active(), 'tab-1', 'the last chosen tab is shown')
  assert.equal(await focusedTab(), 'tab-1', 'the shown tab takes the focus')
  await openStarter()
  assert.equal(await entries().count(), 0, 'reopening every tab empties the list')
  assert.equal(await panel.locator('.starter-recent-empty').isVisible(), true, 'the empty list returns')
  await closeStarter()
  await closeStarter()

  // The panel closes on a click outside, leaving the list for the next visit.
  await closeTab('tab-0')
  await openStarter()
  assert.equal(await entries().count(), 1, 'the close is listed')
  await page.locator('.ids-field input').click()
  await panel.waitFor({ state: 'detached' })
  await openStarter()
  assert.deepEqual(await names(), ['⿾正'], 'the list is still there')
  await closeStarter()

  // An empty tab brought back from the list is a tab of its own; an older group restored after it
  // keeps it rather than taking it for the empty tab that close left behind.
  const solo = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  await solo.addInitScript(() => {
    const tab = { id: 'tab-solo', sequence: '⿰氵恩', saved: '⿰氵恩' }
    localStorage.setItem('ids-input:tabs', JSON.stringify([tab]))
    localStorage.setItem('ids-input:activeTab', JSON.stringify(tab.id))
  })
  const soloPage = await solo.newPage()
  soloPage.on('pageerror', error => errors.push(error.message))
  await soloPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await soloPage.locator('.ids-field input').waitFor({ timeout: 120000 })
  const soloOrder = () => soloPage.locator('.tabbar .tab').evaluateAll(els => els.map(el => /** @type {HTMLElement} */ (el).dataset.tabId))
  const soloPanel = soloPage.locator('.starter-panel')
  await soloPage.locator('.tab[data-tab-id="tab-solo"] [role="tab"]').click({ button: 'middle' })
  const placeholder = (await soloOrder())[0]
  assert.notEqual(placeholder, 'tab-solo', 'closing the only tab leaves an empty one')
  await soloPage.locator(`.tab[data-tab-id="${placeholder}"] [role="tab"]`).click({ button: 'middle' })
  assert.equal((await soloOrder()).length, 1, 'closing that empty tab leaves another')
  await soloPage.locator('.starter-trigger').click()
  await soloPanel.getByRole('tab', { name: 'Recently closed', exact: true }).click()
  const soloNames = () => soloPanel.locator('.starter-recent-name').allInnerTexts()
  assert.deepEqual(await soloNames(), ['Untitled', '⿰氵恩'], 'the empty tab and the tab before it are both listed')
  assert.equal(await soloPanel.locator('.starter-recent-item').first().locator('.starter-recent-thumb .tab-empty').count(), 1, 'an empty tab shows a placeholder thumbnail')
  await soloPanel.locator('.starter-recent-item').first().click()
  await soloPanel.waitFor({ state: 'detached' })
  assert.equal((await soloOrder()).length, 1, 'the empty tab comes back')
  await soloPage.locator('.starter-trigger').click()
  await soloPanel.getByRole('tab', { name: 'Recently closed', exact: true }).click()
  await soloPanel.locator('.starter-recent-item').first().click()
  await soloPanel.waitFor({ state: 'detached' })
  assert.equal((await soloOrder()).length, 2, 'the older tab joins the empty tab already reopened')
  assert.equal(await soloPage.locator('.ids-field input').inputValue(), '⿰氵恩', 'the older tab is shown')
  await solo.close()

  assert.deepEqual(errors, [])
  console.log('PASS the starter lists each closed tab with its thumbnail and opens it back')
} finally { await browser.close() }
