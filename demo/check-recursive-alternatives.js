// Run against a served demo: IDS_URL=http://127.0.0.1:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-recursive-alternatives.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: process.env.IDS_DARK ? 'dark' : 'light' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const field = page.locator('.ids-field input')
  const labels = () => page.locator('.ids-option-label').allTextContents()
  /** Wait until the groups read exactly `expected`, as results stream in. @param {string[]} expected */
  const groupsAre = async expected => {
    try {
      await page.waitForFunction(list => {
        const found = [...document.querySelectorAll('.ids-option-label')].map(element => element.textContent)
        return found.length === list.length && found.every((label, i) => label === list[i])
      }, expected, { timeout: 120000 })
    } catch (error) {
      console.error(`groups were ${JSON.stringify(await labels())}, expected ${JSON.stringify(expected)}; title ${JSON.stringify(await page.locator('.ids-title').textContent())}`)
      throw error
    }
  }
  /** The alternatives under the group named `name`. @param {string} name */
  const group = name => page.getByRole('group', { name, exact: true })

  await page.goto(`${url}/?ids=${encodeURIComponent('⿰吋吋')}`, { waitUntil: 'domcontentloaded' })
  await field.waitFor()
  await page.locator('.ids-tree .ids-op').first().click()
  await field.focus()
  await groupsAre(['Split'])
  const splitChoices = group('Split').locator('button')
  for (const sequence of ['⿰⿰口寸吋', '⿰吋⿰口寸', '⿰⿰口寸⿰口寸']) await splitChoices.getByText(sequence, { exact: true }).waitFor({ timeout: 120000 })
  assert.equal(await group('Merge').count(), 0, 'an expansion alone has no merge group')
  assert.equal(await group('Split and merge').count(), 0, 'an expansion alone has no mixed group')

  const panelBox = await page.locator('.ids-swaps').boundingBox()
  const toolsBox = await page.locator('.ids-part-tools .ids-tools').boundingBox()
  assert.ok(panelBox && toolsBox, 'the list and the tools are laid out')
  assert.ok(panelBox.y >= toolsBox.y + toolsBox.height, 'the alternatives drop below the tools')
  assert.ok(panelBox.y + panelBox.height >= 860, 'the alternatives reach the bottom edge')

  const more = page.locator('.ids-more')
  await more.waitFor({ timeout: 120000 })
  await more.focus()
  await more.press('Enter')
  assert.equal(await more.evaluate(element => element === document.activeElement), true, 'loading more keeps keyboard focus')
  assert.equal(await splitChoices.getByText('⿰⿰口寸⿰口寸', { exact: true }).count(), 1, 'existing alternatives remain while more load')
  await page.waitForFunction(() => document.querySelector('.ids-swaps')?.getAttribute('aria-busy') === 'false', null, { timeout: 120000 })
  if (await more.count()) {
    assert.equal(await more.evaluate(element => element === document.activeElement), true, 'focus remains after loading more')
    assert.equal(await more.getAttribute('aria-disabled'), 'false', 'the resting more button can be pressed again')
  }

  await page.goto(`${url}/?ids=${encodeURIComponent('⿱始𠮟')}`, { waitUntil: 'domcontentloaded' })
  await field.waitFor()
  await page.locator('.ids-tree .ids-op').first().click()
  await field.focus()
  await groupsAre(['Merge', 'Split', 'Split and merge'])
  const shown = await page.locator('.ids-options button').count()
  for (let i = 0; i < 8; i++) {
    const next = page.locator('.ids-more')
    if (!(await next.count())) break
    assert.equal(await next.getAttribute('aria-disabled'), 'false', 'a resting more button stays pressable')
    await next.click()
    await page.waitForFunction(() => document.querySelector('.ids-swaps')?.getAttribute('aria-busy') === 'true', null, { timeout: 30000 }).catch(() => {})
    await page.waitForFunction(() => document.querySelector('.ids-swaps')?.getAttribute('aria-busy') === 'false', null, { timeout: 120000 })
  }
  assert.ok(await page.locator('.ids-options button').count() > shown, 'pressing more adds alternatives')
  assert.equal(await page.locator('.ids-more').count(), 0, 'the more button goes once every alternative is shown')
  assert.ok(await page.locator('.ids-swaps').evaluate(element => element.scrollTop) > 0, 'the list keeps its scroll when the more control goes')

  await page.goto(`${url}/?ids=${encodeURIComponent('⿰⿰口寸⿰口寸')}`, { waitUntil: 'domcontentloaded' })
  await field.waitFor()
  await page.locator('.ids-tree .ids-op').first().click()
  await field.focus()
  await groupsAre(['Merge', 'Split', 'Split and merge'])
  const compressed = group('Merge').locator('button').getByText('⿰吋吋', { exact: true })
  await compressed.waitFor({ timeout: 120000 })
  await compressed.click()
  assert.equal(await field.inputValue(), '⿰吋吋', 'both nested nodes can be merged together')
  await page.locator('.toast button').click()
  assert.equal(await field.inputValue(), '⿰⿰口寸⿰口寸', 'the merge can be undone')

  await page.goto(`${url}/?ids=${encodeURIComponent('⿰⿱一口吋')}`, { waitUntil: 'domcontentloaded' })
  await field.waitFor()
  await page.locator('.ids-tree .ids-op').first().click()
  await field.focus()
  await groupsAre(['Merge', 'Split', 'Split and merge'])
  await group('Split').locator('button').getByText('⿰⿱一口⿰口寸', { exact: true }).waitFor({ timeout: 120000 })
  await group('Merge').locator('button').getByText('⿰𠮛吋', { exact: true }).waitFor({ timeout: 120000 })
  const mixed = group('Split and merge').locator('button').getByText('⿰𠮛⿰口寸', { exact: true })
  await mixed.waitFor({ timeout: 120000 })
  if (process.env.IDS_SHOT) {
    await field.focus()
    await page.locator('.ids-swaps').evaluate(element => { element.scrollTop = 0 })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: process.env.IDS_SHOT })
  }
  await mixed.click()
  assert.equal(await field.inputValue(), '⿰𠮛⿰口寸', 'a mixed alternative replaces the chosen node')
  await page.locator('.toast button').click()
  assert.equal(await field.inputValue(), '⿰⿱一口吋', 'the mixed alternative can be undone')

  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS recursive alternatives are grouped by split, merge and both, and each choice is undoable')
} finally { await browser.close() }
