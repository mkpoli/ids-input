// A component the export draws variation sequences of has a button in the tree that lists them;
// choosing one writes the selector after the character and the preview draws that glyph. Run
// against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-variation-sequences.js
// IDS_COMPOSER names another export to draw from; IDS_SHOTS a folder to write screenshots into.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { join } from 'node:path'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://127.0.0.1:5199'
const composer = process.env.IDS_COMPOSER ? `&composer=${encodeURIComponent(process.env.IDS_COMPOSER)}` : ''
const shots = process.env.IDS_SHOTS
const DOTTED = '者\u{E0101}'
try {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const field = page.locator('.ids-field input')
    const drawing = () => page.locator('#output-panel .ids-preview svg path').first().getAttribute('d')
    const shot = async name => { if (shots) await page.screenshot({ path: join(shots, `${name}-${scheme}.png`) }) }
    await page.goto(`${url}/?ids=${encodeURIComponent('⿰氵者')}${composer}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    const toggle = page.locator('.ids-tree .ids-forms-toggle')
    await toggle.waitFor()
    assert.equal(await toggle.count(), 1, 'only 者 has variation sequences here')
    await page.waitForFunction(() => document.querySelector('#output-panel .ids-preview svg path')?.getAttribute('d'))
    const plain = await drawing()
    await shot('variants-before')

    await toggle.click()
    const forms = page.locator('.ids-menu .ids-menu-form')
    assert.equal(await forms.count(), 2, 'the plain character and its one sequence')
    assert.equal(await forms.nth(0).getAttribute('aria-checked'), 'true', 'the plain character is the one written')
    assert.equal(await forms.nth(1).getAttribute('title'), 'U+8005 U+E0101')
    await page.waitForFunction(() => [...document.querySelectorAll('.ids-menu-form svg path')].every(path => path.getAttribute('d')) && document.querySelectorAll('.ids-menu-form svg path').length === 2)
    const [first, second] = await forms.evaluateAll(buttons => buttons.map(button => button.querySelector('path')?.getAttribute('d')))
    assert.notEqual(first, second, 'each form is drawn as its own glyph')
    await shot('variants-open')

    await forms.nth(1).click()
    assert.equal(await field.inputValue(), `⿰氵${DOTTED}`, 'the selector is written after the character')
    await page.waitForFunction(before => { const d = document.querySelector('#output-panel .ids-preview svg path')?.getAttribute('d'); return d && d !== before }, plain)
    assert.equal(await page.locator('.ids-menu').count(), 0, 'choosing closes the list')
    assert.ok(await page.locator('.ids-tree .ids-part.chosen .ids-form svg').count(), 'the tree shows the chosen glyph')
    await page.waitForTimeout(400)
    await shot('variants-after')

    // The keyboard: the button opens the list on the form in use, the arrows move, Enter chooses.
    await toggle.focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('title')), 'U+8005 U+E0101', 'the form in use takes the focus')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    assert.equal(await field.inputValue(), '⿰氵者', 'the plain character is written again')
    await page.waitForFunction(before => document.querySelector('#output-panel .ids-preview svg path')?.getAttribute('d') === before, plain)

    // The context menu lists them too; Escape leaves the description as it is.
    await page.locator('.ids-tree .ids-part').nth(1).click({ button: 'right' })
    assert.equal(await page.locator('.ids-menu .ids-menu-form').count(), 2, 'the context menu lists the forms')
    assert.ok(await page.locator('.ids-menu .ids-menu-op').count(), 'beside its operators')
    await page.keyboard.press('Escape')
    assert.equal(await field.inputValue(), '⿰氵者')

    // In an enclosure both parts keep a button the pointer reaches, and a double click on one edits nothing.
    await page.goto(`${url}/?ids=${encodeURIComponent('⿺辶者')}${composer}`, { waitUntil: 'domcontentloaded' })
    await toggle.nth(1).waitFor()
    assert.equal(await toggle.count(), 2, '辶 and 者 both have variation sequences')
    const reached = await toggle.evaluateAll(buttons => buttons.map(button => {
      const r = button.getBoundingClientRect()
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.ids-forms-toggle') === button
    }))
    assert.deepEqual(reached, [true, true], 'neither button is covered')
    await shot('variants-enclosure')
    await toggle.nth(1).dblclick()
    assert.equal(await page.locator('.ids-tree .inline-edit').count(), 0, 'a double click on the button edits no part')
    await page.keyboard.press('Escape')
    await toggle.nth(1).click()
    await page.locator('.ids-menu .ids-menu-form').nth(1).click()
    assert.equal(await field.inputValue(), `⿺辶${DOTTED}`)
    assert.ok(await toggle.nth(1).evaluate(button => button === document.activeElement), 'the focus returns to the button')
    await page.keyboard.press('Backspace')
    assert.equal(await field.inputValue(), `⿺辶${DOTTED}`, 'Backspace on the button clears nothing')
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('variation sequences: ok')
} finally {
  await browser.close()
}
