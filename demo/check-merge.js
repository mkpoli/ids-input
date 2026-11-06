// A chosen node offers the characters it encodes: ⿱一口 merges to 𠮛, a node with a modifier keeps
// the character the modifier names, an inner node merges without touching its siblings, a component
// offers no merge, and the step can be undone. Run against a served demo:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-merge.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const field = page.locator('.ids-field input')
  const value = () => field.inputValue()
  const open = async sequence => {
    await page.goto(`${url}/?ids=${encodeURIComponent(sequence)}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await page.waitForTimeout(600)
  }
  /** Choose a node by its operator button; the card the click opens gives way to the field. */
  const choose = async index => {
    await page.locator('.ids-tree .ids-op').nth(index).click()
    await field.focus()
  }
  const merge = page.locator('.ids-swap.ids-merge')

  await open('⿱一口')
  await choose(0)
  await merge.first().waitFor({ timeout: 120000 })
  assert.equal(await page.locator('.ids-title').textContent(), 'Merge ⿱一口 to a character', 'the list names the chosen node')
  assert.equal(await merge.count(), 1, 'one character describes ⿱一口')
  assert.equal(await merge.first().textContent(), '𠮛', 'the character ⿱一口 encodes')
  assert.equal(await merge.first().getAttribute('title'), 'Merge ⿱一口 to 𠮛', 'the button names both sides')
  await merge.first().click()
  assert.equal(await value(), '𠮛', 'the node is replaced by the character it encodes')
  await merge.first().waitFor({ state: 'detached' })
  assert.equal(await page.locator('.ids-merge').count(), 0, 'the merge list closes once the node is a character')
  assert.ok((await page.locator('.toast').innerText()).includes('Merge ⿱一口 to 𠮛'), 'the undo toast names the step')
  await page.locator('.toast button').click()
  assert.equal(await value(), '⿱一口', 'the merge can be undone')

  await open('⿻[1:]丨日')
  await choose(0)
  await merge.first().waitFor({ timeout: 120000 })
  assert.deepEqual(await merge.allTextContents(), ['甲'], 'a modifier keeps the character it names, not the modifier-free reading')
  await merge.first().click()
  assert.equal(await value(), '甲', 'the modifier narrowed the merge to one character')

  await open('⿰口⿱一口')
  await choose(1)
  await merge.first().waitFor({ timeout: 120000 })
  await merge.first().click()
  assert.equal(await value(), '⿰口𠮛', 'only the chosen node merges, its sibling stays')

  await open('⿰口明')
  await page.locator('.ids-tree .ids-part').nth(1).click()
  await field.focus()
  await page.locator('.ids-swap.ids-split').first().waitFor({ timeout: 120000 })
  assert.equal(await page.locator('.ids-merge').count(), 0, 'a component offers no merge')

  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS a chosen node merges to a character it encodes, exact under a modifier, alone and undoably, while a component offers no merge')
} finally { await browser.close() }
