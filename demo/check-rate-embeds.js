// Run against a workshop dev server with IDS_URL=http://127.0.0.1:5199 bun demo/check-rate-embeds.js.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { rateFormsFor } from '@han-compose/composer/rate-forms'

const base = new URL(process.env.IDS_URL ?? 'http://127.0.0.1:5199')
const start = '⿰蟀蟀'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })

async function checkChoices(editor, readSaved) {
  const field = editor.locator('.sequence-wrap input').first()
  await field.fill(start)
  for (const form of rateFormsFor('蟀')) {
    await editor.locator('.ids-forms-toggle[data-hover-path="1"]').click()
    const option = editor.getByRole('menuitemradio').and(editor.locator(`[data-rate-form="${form.id}"]`))
    await option.locator('svg path').waitFor()
    assert.equal((await option.innerText()).trim(), '')
    const label = await option.getAttribute('aria-label')
    assert.ok(label && !/CN|JP|＞＜/.test(label))
    for (const selector of form.text.matchAll(/[\u{E0100}-\u{E01EF}]/gu)) {
      assert.ok(label.includes('U+' + selector[0].codePointAt(0).toString(16).toUpperCase()))
    }
    await option.click()
    const expected = '⿰蟀' + form.text
    assert.equal(await field.inputValue(), expected)
    await readSaved(expected)
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(new URL('embed.html', base).href, { waitUntil: 'domcontentloaded' })
  await checkChoices(page, async expected => {
    await page.locator('.ids-use').click()
    assert.equal(await page.locator('output.used').textContent(), expected)
  })

  // A selector in the character card can also be changed to a structural catalogue form.
  // Hovering the second copy edits the hovered operand, independently of the existing selection.
  const field = page.locator('.sequence-wrap input').first()
  await field.fill('⿰率󠄀率󠄀')
  const hovered = page.locator('.ids-tree .ids-part[data-path="1"]')
  await hovered.hover()
  const card = page.locator('.ids-character-info:popover-open')
  const group = card.locator('[data-variation-family="rate/率"]')
  await group.locator('button[data-form-id] svg path').first().waitFor()
  assert.equal(await group.locator('button[data-form-id]').count(), 4)
  assert.equal(await card.locator('.vs-pill').innerText(), 'VS17')
  assert.ok(await card.locator('.vs-input').isVisible())
  const structural = rateFormsFor('率')[0]
  await group.locator('button[data-form-id]').first().click()
  assert.equal(await field.inputValue(), '⿰率󠄀' + structural.text)

  const parentURL = new URL('check-rate-embeds', base).href
  await page.route(parentURL, route => route.fulfill({
    contentType: 'text/html',
    body: `<script>
      window.addEventListener('message', event => {
        if (event.source === document.querySelector('iframe')?.contentWindow &&
            event.data?.type === 'ids-input:sequence') window.saved = event.data.sequence
      })
    </script><iframe style="width:1350px;height:900px" src="editor.html"></iframe>`
  }))
  await page.goto(parentURL, { waitUntil: 'domcontentloaded' })
  const frame = page.frameLocator('iframe')
  await checkChoices(frame, expected => page.waitForFunction(value => window.saved === value, expected))
  // The compound has two independently editable 幺 although the tree currently shows one 絲.
  await frame.locator('.sequence-wrap input').first().fill('⿰水絲')
  await frame.locator('.ids-forms-toggle[data-hover-path="1"]').click()
  const sites = frame.locator('[role=menu] [data-variation-family^="VR/5E7A@"]')
  assert.equal(await sites.count(), 2)
  await sites.nth(1).locator('button[data-form-id="folded"]').click()
  await page.waitForFunction(() => window.saved === '⿰水⿰糹⿱&VR-5E7A-02;小')
  const saved = await page.evaluate(() => window.saved)
  const reopening = page.waitForEvent('framenavigated', frame =>
    frame.parentFrame() !== null && new URL(frame.url()).searchParams.get('ids') === saved)
  await page.evaluate(sequence => {
    document.querySelector('iframe').src = 'editor.html?ids=' + encodeURIComponent(sequence)
  }, saved)
  const reopened = await reopening
  await reopened.waitForFunction(sequence =>
    document.querySelector('.sequence-wrap input')?.value === sequence, saved)
} finally {
  await browser.close()
}
