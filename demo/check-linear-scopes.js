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
    const geometry = await page.locator('.sequence-scopes g').evaluateAll(groups => groups.map(group => {
      const segments = [...group.querySelectorAll('.scope-segment')].map(path => {
        const [, start, , end] = path.getAttribute('d').match(/M ([\d.]+) ([\d.]+) H ([\d.]+)/).map(Number)
        return { start, end }
      })
      const lead = group.querySelector('.scope-lead').getAttribute('d')
      const run = group.closest('.sequence-run')
      const token = run.querySelector(`span[data-path="${group.dataset.path}"]`)
      const origin = run.getBoundingClientRect().left
      return {
        gaps: segments.slice(1).map((segment, index) => segment.start - segments[index].end),
        started: Number(lead.match(/^M ([\d.]+)/)[1]),
        left: token.getBoundingClientRect().left - origin,
        separation: segments[0].start - Number(lead.match(/([\d.]+) ([\d.]+)$/)[1])
      }
    }))
    assert.ok(geometry.every(scope => scope.gaps.every(gap => Math.abs(gap - 5) < .01)), 'adjacent segments keep one gap')
    assert.ok(geometry.every(scope => Math.abs(scope.started - scope.left) < .01), 'each lead starts at its IDC left edge')
    assert.equal(await page.locator('.scope-lead').first().evaluate(element => getComputedStyle(element).strokeLinecap), 'butt')
    assert.ok(geometry.every(scope => Math.abs(scope.separation - 5) < .01), 'each lead stops one gap before its first segment')
    await page.locator('.ids-op[data-path="0"]').hover()
    assert.equal(await page.locator('.sequence-paint .hovered').count(), 3)
    await page.locator('#tree-tab').click()
    await page.locator('[role=treeitem][data-path="0.0"]').hover()
    assert.equal(await page.locator('.scope-segment.scope-hovered').count(), 1)
    assert.equal(await page.locator('.scope-lead.scope-hovered').count(), 1)
    await page.locator('[role=treeitem][data-path="0.0"]').click()
    assert.equal(await page.locator('.scope-segment.scope-selected').count(), 1)
    assert.equal(await page.locator('.scope-lead.scope-selected').count(), 1)
    await field.fill('⿰⿱木火⿱日月')
    await field.focus()
    await field.evaluate(element => { element.setSelectionRange(2, 3); element.dispatchEvent(new Event('select')) })
    assert.equal(await page.locator('.scope-segment.scope-selected').count(), 1)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const tintMode = page.getByRole('combobox', { name: 'Part tint', exact: true })
    await tintMode.selectOption('on')
    await page.keyboard.press('Escape')
    const strokes = await page.locator('.scope-segment').evaluateAll(elements => [...new Set(elements.map(element => getComputedStyle(element).stroke))])
    assert.ok(strokes.length > 1, 'operand segments keep their branch tints')
    await page.emulateMedia({ forcedColors: 'active' })
    assert.equal(await page.locator('.sequence-scopes').evaluate(element => getComputedStyle(element).visibility), 'visible')
    assert.notEqual(await page.locator('.scope-segment').first().evaluate(element => getComputedStyle(element).stroke), 'none')
    await page.emulateMedia({ forcedColors: 'none' })
    await field.fill('⿴[1]囗水')
    await page.waitForFunction(() => document.querySelectorAll('.scope-segment').length === 2)
    const aligned = await page.locator('.sequence-run').evaluate(run => {
      const spans = [...run.querySelectorAll('span')]
      const origin = run.getBoundingClientRect().left
      const segment = run.querySelector('.scope-segment')
      return Math.abs(Number(segment.getAttribute('d').split(' ')[1]) - (spans[1].getBoundingClientRect().left - origin + 2.5)) < .1
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
    console.log(`PASS ${colorScheme}: scope segmentation, root, curves, hover and selection, branch tints, forced colors, draft states, deep scrolling, phone`)
  }
} finally { await browser.close() }
