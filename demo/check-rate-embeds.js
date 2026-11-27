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
