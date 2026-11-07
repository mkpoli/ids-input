// Run locally with IDS_URL pointing to the workshop preview.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, colorScheme })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('https://glyphatlas.org/**', route => route.abort())
    await page.goto(process.env.IDS_URL ?? 'http://127.0.0.1:5198', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill('⿰⿱木火⿱日月')
    await page.waitForFunction(() => document.querySelectorAll('.scope-lead').length === 3)
    assert.equal(await page.locator('.scope-segment').count(), 6)
    assert.equal(await page.locator('.sequence-scopes g[data-path=""]').count(), 1)
    const leads = await page.locator('.scope-lead').evaluateAll(els => els.map(el => el.getAttribute('d')))
    assert.ok(leads.every(d => /[CQ]/.test(d)), 'each IDC has a curved lead')
    await page.locator('.ids-op[data-path="0"]').hover()
    assert.equal(await page.locator('.sequence-paint .hovered').count(), 3)
    await field.fill('⿴[1]囗水')
    await page.waitForFunction(() => document.querySelectorAll('.scope-segment').length === 2)
    const aligned = await page.locator('.sequence-run').evaluate(run => {
      const spans = [...run.querySelectorAll('span')]
      const origin = run.getBoundingClientRect().left
      const segment = run.querySelector('.scope-segment')
      return Math.abs(Number(segment.getAttribute('d').split(' ')[1]) - (spans[1].getBoundingClientRect().left - origin + 1.5)) < .1
    })
    assert.ok(aligned, 'operator notes use measured token widths')
    await field.fill('木')
    await page.waitForFunction(() => document.querySelectorAll('.scope-lead').length === 0)
    await field.fill('⿰')
    assert.equal(await field.getAttribute('aria-invalid'), 'false')
    await field.fill('invalid draft')
    await page.waitForFunction(() => document.querySelectorAll('.scope-lead').length === 0)
    await field.fill('⿾'.repeat(20) + '木')
    await page.waitForFunction(() => document.querySelectorAll('.scope-lead').length === 20)
    await field.press('End')
    await page.waitForFunction(() => document.querySelector('.ids-field input').scrollLeft > 0)
    assert.ok(await page.locator('.sequence-paint').evaluate(el => el.getBoundingClientRect().height > 40))
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await field.isVisible())
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${colorScheme}: scope segmentation, root, curves, hover, draft states, deep scrolling, phone`)
  }
} finally { await browser.close() }
