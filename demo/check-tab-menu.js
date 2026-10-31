// The tab menu: right-clicking a tab reopens the last closed tab or group, duplicates it and closes
// it or the tabs around it, with Close all asking first. The note, Ctrl+Shift+T (where the host
// delivers it), File or the tab menu brings a close back in its old order, showing the tab that was
// active. Run against a devrun server:
//   IDS_URL=http://localhost:5197 CHROMIUM_PATH=/path/to/chrome bun demo/check-tab-menu.js
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
  const item = name => page.getByRole('menuitem', { name, exact: true })
  const open = async id => {
    await page.locator(`.tab[data-tab-id="${id}"] [role="tab"]`).click({ button: 'right' })
    await page.locator('.tab-menu').waitFor()
  }
  const closeMenu = async () => {
    await page.keyboard.press('Escape')
    await page.locator('.tab-menu').waitFor({ state: 'detached' })
  }
  const undo = async () => {
    const button = page.locator('.toast').filter({ hasText: /Closed/ }).last().locator('button')
    await button.waitFor()
    await button.click()
  }
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'four tabs open')
  assert.equal(await active(), 'tab-1', 'the second tab is shown')

  // The menu offers the actions the tab's place allows.
  await open('tab-0')
  assert.equal(await item('Reopen closed tab').isDisabled(), true, 'nothing has been closed yet')
  assert.equal(await item('Close tabs to the left').isDisabled(), true, 'the first tab has nothing on its left')
  assert.equal(await item('Close tabs to the right').isDisabled(), false, 'the first tab has tabs on its right')
  await closeMenu()
  await open('tab-3')
  assert.equal(await item('Close tabs to the left').isDisabled(), false, 'the last tab has tabs on its left')
  assert.equal(await item('Close tabs to the right').isDisabled(), true, 'the last tab has nothing on its right')
  await closeMenu()

  // Close other tabs, then bring them back in their old order with the old tab shown.
  await open('tab-2')
  assert.equal(await active(), 'tab-1', 'right-click leaves the shown tab alone')
  await item('Close other tabs').click()
  assert.deepEqual(await order(), ['tab-2'], 'close other tabs leaves only its tab')
  assert.equal(await active(), 'tab-2', 'the remaining tab is shown')
  assert.match(await page.locator('.toast').filter({ hasText: /Closed/ }).last().innerText(), /Closed 3 tabs/, 'the note counts the closed tabs')
  await undo()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'undo restores the group in order')
  assert.equal(await active(), 'tab-1', 'undo shows the tab that was being edited')

  // The editor state of the closed group comes back with it.
  await page.locator('.ids-field input').fill('⿱日木')
  await open('tab-2')
  await item('Close other tabs').click()
  assert.equal(await page.locator('.ids-field input').inputValue(), '⿱艹半', 'the remaining tab is shown')
  await undo()
  assert.equal(await active(), 'tab-1', 'undo shows the edited tab again')
  assert.equal(await page.locator('.ids-field input').inputValue(), '⿱日木', 'its unsaved text comes back')
  await page.keyboard.press('Control+z')
  assert.equal(await page.locator('.ids-field input').inputValue(), '⿰氵恩', 'its undo history comes back')

  // Close tabs to the left of a tab, showing it when the active tab goes.
  await open('tab-2')
  await item('Close tabs to the left').click()
  assert.deepEqual(await order(), ['tab-2', 'tab-3'], 'close to the left keeps the tab and what is right of it')
  assert.equal(await active(), 'tab-2', 'the tab whose menu was used is shown')
  await undo()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'undo restores the left tabs')
  assert.equal(await active(), 'tab-1', 'undo shows the tab that was being edited')

  // Close tabs to the right; an active tab that survives stays.
  await open('tab-1')
  await item('Close tabs to the right').click()
  assert.deepEqual(await order(), ['tab-0', 'tab-1'], 'close to the right keeps the tab and what is left of it')
  assert.equal(await active(), 'tab-1', 'a surviving active tab stays shown')
  await undo()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'undo restores the right tabs')

  // Close all asks first; cancelling keeps every tab.
  await open('tab-2')
  await item('Close all tabs').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  assert.equal(await dialog.getByRole('heading').innerText(), 'Close all tabs', 'the dialog names the action')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.equal((await order()).length, 4, 'cancelling keeps the tabs')
  await open('tab-2')
  await item('Close all tabs').click()
  await dialog.getByRole('button', { name: 'Close all', exact: true }).click()
  assert.equal((await order()).length, 1, 'confirming leaves one empty tab')
  assert.equal(await page.locator('.ids-field input').inputValue(), '', 'the replacement tab is empty')
  assert.equal(await page.locator('.tabbar .tab.on [role="tab"]').evaluate(el => el === document.activeElement), true, 'the replacement tab takes the focus')
  assert.match(await page.locator('.toast').filter({ hasText: /Closed/ }).last().innerText(), /Closed 4 tabs/, 'the note counts every tab')
  await undo()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'undo restores every tab')
  assert.equal(await active(), 'tab-1', 'undo shows the tab that was being edited')

  // Close tab from the menu, and undo it.
  await open('tab-0')
  await item('Close tab').click()
  assert.deepEqual(await order(), ['tab-1', 'tab-2', 'tab-3'], 'close tab closes the tab whose menu was used')
  assert.equal(await active(), 'tab-1', 'a surviving active tab stays shown')
  await undo()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'undo restores the single tab')
  assert.equal(await active(), 'tab-1', 'a surviving active tab stays shown')

  // Closing the shown tab shows its right neighbour; Undo shows the closed tab again.
  await open('tab-1')
  await item('Close tab').click()
  assert.deepEqual(await order(), ['tab-0', 'tab-2', 'tab-3'], 'close tab closes the shown tab')
  assert.equal(await active(), 'tab-2', 'its right neighbour is shown')
  await undo()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'undo restores the shown tab')
  assert.equal(await active(), 'tab-1', 'undo shows the tab that was closed')

  // Ctrl+Shift+T reopens the last closed tab; the tab menu reopens a whole group.
  await open('tab-0')
  await item('Close tab').click()
  assert.deepEqual(await order(), ['tab-1', 'tab-2', 'tab-3'], 'close tab closes it')
  // Playwright injects this below the browser's own reopen shortcut; the menus are the safe path.
  await page.keyboard.press('Control+Shift+T')
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'Ctrl+Shift+T reopens the closed tab')
  await page.keyboard.press('Control+Shift+T')
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'a second reopen has nothing left to open')
  assert.equal(await active(), 'tab-0', 'reopening shows the tab')
  assert.equal(await page.locator('.toast').filter({ hasText: /Closed/ }).count(), 0, 'reopening takes the close note away')
  await open('tab-2')
  await item('Close other tabs').click()
  assert.deepEqual(await order(), ['tab-2'], 'only the menu tab is left')
  await open('tab-2')
  assert.equal(await item('Reopen closed tab').isDisabled(), false, 'the menu offers the closed group')
  await page.getByRole('menuitem', { name: /Reopen closed tab/ }).click()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'the menu reopens the whole group')
  assert.equal(await active(), 'tab-0', 'the reopened group shows the tab that was active')

  // The File menu opens the same history.
  await open('tab-0')
  await item('Close tab').click()
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: /Reopen closed tab/ }).click()
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3'], 'the File menu reopens the closed tab')
  assert.equal(await active(), 'tab-0', 'the File menu shows the tab it reopened')

  // Shift+F10 opens the menu on the focused tab and the arrows walk the enabled items.
  await open('tab-0')
  assert.equal(await item('Reopen closed tab').isDisabled(), true, 'the reopen history is empty again')
  await closeMenu()
  await page.locator('.tab[data-tab-id="tab-0"] [role="tab"]').focus()
  await page.keyboard.press('Shift+F10')
  await page.locator('.tab-menu').waitFor()
  const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim())
  assert.equal(await focused(), 'Duplicate tab', 'the menu starts on its first action')
  await page.keyboard.press('ArrowDown')
  assert.equal(await focused(), 'Close tab', 'ArrowDown moves to the next action')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  assert.equal(await focused(), 'Close tabs to the right', 'the arrows skip the disabled side')
  await page.keyboard.press('End')
  assert.equal(await focused(), 'Close all tabs', 'End reaches the last action')
  await closeMenu()
  assert.equal(await page.locator('.tab[data-tab-id="tab-0"] [role="tab"]').evaluate(el => el === document.activeElement), true, 'closing the menu returns to its tab')

  // A replacement left behind by Close all goes when the group comes back after another tab.
  await open('tab-2')
  await item('Close all tabs').click()
  await page.locator('dialog[open]').getByRole('button', { name: 'Close all', exact: true }).click()
  await page.getByRole('button', { name: 'New tab', exact: true }).click()
  const atClose = await order()
  assert.equal(atClose.length, 2, 'Close all left its replacement and the new tab')
  await page.keyboard.press('Control+Shift+T')
  assert.deepEqual(await order(), ['tab-0', 'tab-1', 'tab-2', 'tab-3', atClose[1]], 'the replacement goes and the new tab stays')
  assert.equal(await active(), 'tab-0', 'the reopened group shows the tab that was active')

  // Any edit, even text the editor cannot read, spends the close note.
  await open('tab-2')
  await item('Close other tabs').click()
  assert.equal(await page.locator('.toast').filter({ hasText: /Closed/ }).count(), 1, 'the close leaves its note')
  await page.locator('.ids-field input').fill('⿰木木木')
  assert.equal(await page.locator('.toast').filter({ hasText: /Closed/ }).count(), 0, 'a draft edit takes the note away')

  assert.deepEqual(errors, [])
  console.log('PASS tab menu closes single, group and all tabs, with undo and reopen')
} finally { await browser.close() }
