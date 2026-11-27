// IDS_URL=http://127.0.0.1:5199 bun demo/check-variation-families.js
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { grassIVS } from '@han-compose/composer/variants'

const url = new URL('fixtures/variation-families.html', process.env.IDS_URL ?? 'http://127.0.0.1:5199')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 920 } })
  const field = page.locator('.sequence-wrap input').first()
  const toggle = page.locator('.ids-forms-toggle[data-hover-path="1"]')
  const menu = page.getByRole('menu')
  async function choose(family, id, expected) {
    await toggle.click()
    assert.equal(await menu.locator('[data-variation-family="comparison"]').count(), 0)
    const group = menu.locator(`[data-variation-family="${family}"]`)
    const option = group.locator(`[data-form-id="${id}"]`)
    await option.click()
    assert.equal(await field.inputValue(), expected)
    await page.locator('.ids-use').click()
    assert.equal(await page.locator('output').textContent(), expected)
  }
  await page.goto(url.href)
  await choose('X-00053', '2', '⿰{53}&CDP-8964;')
  await choose('X-00053', '3', '⿰{53}⿱丿⿴#(-𠃌㇉)丶')
  url.searchParams.set('ids', await field.inputValue())
  await page.goto(url.href)
  await choose('X-00053', '1', '⿰{53}{53}')
  await field.fill('⿰艹艹')
  await choose('grass', grassIVS.split, '⿰艹' + grassIVS.split)
  await choose('grass', grassIVS.connected, '⿰艹' + grassIVS.connected)
} finally {
  await browser.close()
}
