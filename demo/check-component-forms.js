// A component's variant menu in the tree lists what else it may be written as: with the component
// variation lists, the other characters and descriptions of its UCV and NUCV entries, and the forms
// no code point names, each written with its variant identifier and drawn from its outline. Run
// against a devrun server:
//   IDS_URL=http://localhost:5173 CHROMIUM_PATH=/path/to/chrome bun demo/check-component-forms.js
// IDS_SHOTS names a folder to write screenshots into.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { join } from 'node:path'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
const shots = process.env.IDS_SHOTS
try {
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    page.setDefaultNavigationTimeout(120000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const field = page.locator('.ids-field input')
    const menuForms = () => page.locator('.ids-menu .ids-menu-form').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-form')))
    // The preview cross-fades each new drawing in; a picture is taken once one layer is left.
    const settled = () => page.waitForFunction(() => {
      const layers = [...document.querySelectorAll('#output-panel .ids-preview-large .layer')]
      return document.querySelector('#output-panel .ids-preview')?.getAttribute('data-label') !== 'loading' && layers.length === 1 && !layers[0].getAnimations().length
    }, null, { timeout: 180000 })
    const shot = async name => { if (shots) { await settled(); await page.screenshot({ path: join(shots, `${name}-${scheme}.png`) }) } }

    // A unifiable entry: 壬 may be written as 王 or 𡈼, its siblings in UCV #1, or as the entry's
    // second form, which no code point names.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('⿰氵壬')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    const toggle = page.locator('.ids-tree .ids-cell[data-index="1"] .ids-forms-toggle')
    await toggle.waitFor()
    await shot('forms-before')
    await toggle.click()
    assert.deepEqual(await menuForms(), ['壬', '壬q0012', '王', '𡈼'])
    assert.deepEqual(await page.locator('.ids-menu .ids-menu-title').allInnerTexts(), ['Forms of 壬', 'UCV 1'])
    assert.equal(await page.locator('.ids-menu .ids-menu-form[data-form="壬q0012"]').getAttribute('title'), '壬q0012 · UCV 1')
    assert.equal(await page.locator('.ids-menu .ids-menu-form[data-form="壬"]').getAttribute('aria-checked'), 'true')
    assert.equal(await page.locator('.ids-menu .ids-menu-form[data-form="王"]').getAttribute('title'), 'U+738B · UCV 1')
    await page.waitForFunction(() => [...document.querySelectorAll('.ids-menu-form svg path')].filter(path => path.getAttribute('d')).length === 4, null, { timeout: 180000 })
    const drawings = await page.locator('.ids-menu .ids-menu-form svg path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
    assert.equal(new Set(drawings).size, 4, 'each form is drawn as its own glyph')
    await shot('forms-open')
    // The form already written changes nothing and leaves no step to undo.
    // The undo button names the step it would take back.
    const undo = () => page.locator('button[aria-label^="Undo"], button[title^="Undo"]').first().evaluate(button => `${button.getAttribute('aria-label')}|${button.getAttribute('title')}|${/** @type {HTMLButtonElement} */ (button).disabled}`)
    const before = await undo()
    await page.locator('.ids-menu .ids-menu-form[data-form="壬"]').click()
    assert.equal(await field.inputValue(), '⿰氵壬')
    assert.equal(await undo(), before, 'choosing the written form records nothing')
    await toggle.click()
    await page.locator('.ids-menu .ids-menu-form[data-form="王"]').click()
    assert.equal(await field.inputValue(), '⿰氵王', 'the sibling takes the component\'s place')
    assert.equal(await page.locator('.ids-menu').count(), 0, 'choosing closes the list')
    await shot('forms-after')

    // The form no code point names is written with its identifier and drawn from its outline.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('⿰氵壬')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await toggle.waitFor()
    await settled()
    const plain = await page.locator('#output-panel .ids-preview svg path').first().getAttribute('d')
    await toggle.click()
    await page.locator('.ids-menu .ids-menu-form[data-form="壬q0012"]').click()
    assert.equal(await field.inputValue(), '⿰氵壬q0012', 'the identifier is written after the component')
    await page.waitForFunction(before => { const d = document.querySelector('#output-panel .ids-preview svg path')?.getAttribute('d'); return d && d !== before }, plain, { timeout: 180000 })
    await page.locator('.ids-tree .ids-part .ids-form svg path[d]').waitFor({ state: 'attached', timeout: 180000 })
    await shot('forms-variant')
    await toggle.click()
    assert.equal(await page.locator('.ids-menu .ids-menu-form[data-form="壬q0012"]').getAttribute('aria-checked'), 'true')
    await page.locator('.ids-menu .ids-menu-form[data-form="壬"]').click()
    assert.equal(await field.inputValue(), '⿰氵壬', 'the plain character is written again')

    // A component that is the whole text is offered no variant identifier: only a description carries one.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('壬')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    const alone = page.locator('.ids-tree .ids-forms-toggle')
    await alone.waitFor()
    await alone.click()
    assert.deepEqual(await menuForms(), ['壬', '王', '𡈼'])
    await page.keyboard.press('Escape')

    // A non-unifiable entry is headed as such: 閒 and 間.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('⿰亻閒')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await toggle.waitFor()
    await toggle.click()
    // The export may draw variation sequences of 閒 too; they come before the entry's forms.
    assert.deepEqual(await page.locator('.ids-menu [data-forms="NUCV 325"] .ids-menu-form').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-form'))), ['間'])
    assert.equal((await menuForms())[0], '閒')
    assert.deepEqual(await page.locator('.ids-menu .ids-menu-title').allInnerTexts(), ['Forms of 閒', 'NUCV 325'])
    await page.keyboard.press('Escape')

    // A form an entry gives as a description is put in as that description.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('⿰氵烕')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await toggle.waitFor()
    await toggle.click()
    await page.locator('.ids-menu .ids-menu-form[data-form="⿵戊天"]').click()
    assert.equal(await field.inputValue(), '⿰氵⿵戊天')

    // The context menu lists the same forms above its operators.
    await page.goto(`${url}/?lang=en&ids=${encodeURIComponent('⿰氵壬')}`, { waitUntil: 'domcontentloaded' })
    await field.waitFor()
    await toggle.waitFor()
    await page.locator('.ids-tree .ids-part').nth(1).click({ button: 'right' })
    assert.deepEqual(await menuForms(), ['壬', '壬q0012', '王', '𡈼'])
    assert.ok(await page.locator('.ids-menu .ids-menu-op').count())
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('component forms: ok')
} finally { await browser.close() }
