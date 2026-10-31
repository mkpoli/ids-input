// Checks the design system page in a browser: accessible names, keyboard operation, focus rings,
// contrast, target sizes, the theme switch, reduced motion and forced colours. It uses the same
// checks a person would make, not a snapshot.
//
//   IDS_URL=http://localhost:5178 CHROMIUM_PATH=/path/to/chrome bun demo/check-design.js
//   IDS_DESIGN_SHOTS=shots bun demo/check-design.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = (process.env.IDS_URL ?? 'http://localhost:5186').replace(/\/$/, '')
const shots = process.env.IDS_DESIGN_SHOTS
if (shots) mkdirSync(shots, { recursive: true })
const pass = message => console.log('PASS', message)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })

/** @param {{ scheme?: 'light' | 'dark', reducedMotion?: 'reduce' | 'no-preference', forcedColors?: 'active' | 'none' }} [options] */
async function open(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1180, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: options.scheme ?? 'light',
    reducedMotion: options.reducedMotion ?? 'no-preference',
    forcedColors: options.forcedColors ?? 'none',
  })
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', error => page.errors.push(error.message))
  await page.goto(`${base}/design.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').waitFor({ timeout: 60000 })
  await page.waitForTimeout(300)
  return { context, page }
}

/** Every control has a name a screen reader can announce. @param {import('playwright-core').Page} page */
async function checkNames(page) {
  const unnamed = await page.evaluate(() => {
    const hasName = el => {
      if (el.getAttribute('aria-label')?.trim()) return true
      const refs = el.getAttribute('aria-labelledby')
      if (refs?.split(/\s+/).some(id => document.getElementById(id)?.textContent.trim())) return true
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent.trim()) return true
      if (el.closest('label')?.textContent.trim()) return true
      if (el.getAttribute('title')?.trim()) return true
      if (el.matches('button, [role="button"]') && el.textContent.trim()) return true
      if (el.matches('input[type="button"], input[type="submit"]') && el.value.trim()) return true
      return false
    }
    return [...document.querySelectorAll('input, select, textarea, button')]
      .filter(el => el.type !== 'hidden' && el.getClientRects().length > 0 && !hasName(el))
      .map(el => el.outerHTML.slice(0, 160))
  })
  assert.deepEqual(unnamed, [], `controls without an accessible name:\n${unnamed.join('\n')}`)
  pass('every control has an accessible name')
}

/** @param {import('playwright-core').Page} page */
async function checkKeyboard(page) {
  const check = page.getByLabel('Copy the outline', { exact: true })
  await check.focus()
  const before = await check.isChecked()
  await page.keyboard.press('Space')
  assert.equal(await check.isChecked(), !before, 'Space toggles a checkbox')
  await page.keyboard.press('Space')
  pass('Space toggles a checkbox')

  const toggle = page.getByRole('switch', { name: 'Key hints on buttons', exact: true })
  assert.equal(await toggle.getAttribute('role'), 'switch', 'the switch is a role="switch" input')
  await toggle.focus()
  const on = await toggle.isChecked()
  await page.keyboard.press('Space')
  assert.equal(await toggle.isChecked(), !on, 'Space toggles a switch')
  pass('Space toggles a switch')

  const first = page.getByRole('radio', { name: 'Left and right', exact: true })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  const second = page.getByRole('radio', { name: 'Above and below', exact: true })
  assert.equal(await second.isChecked(), true, 'ArrowRight moves a radio group')
  assert.equal(await second.evaluate(el => el === document.activeElement), true, 'focus follows the arrow')
  pass('arrow keys move and select within a radio group')

  const hinted = page.getByLabel('Include empty slots', { exact: true })
  assert.equal(await hinted.count(), 1, 'a hint does not join the checkbox name')
  const describedby = await hinted.getAttribute('aria-describedby')
  assert.ok(describedby, 'the checkbox points at its hint')
  const description = await page.evaluate(id => document.getElementById(id)?.textContent ?? '', describedby)
  assert.ok(description.includes('one option among several'), 'the hint is the description')
  pass('hints describe a control without joining its name')

  const noBackground = page.getByRole('radio', { name: 'No background', exact: true })
  await noBackground.focus()
  await page.keyboard.press('ArrowRight')
  const white = page.getByRole('radio', { name: 'White', exact: true })
  assert.equal(await white.isChecked(), true, 'ArrowRight moves a swatch group')
  assert.equal(await white.evaluate(el => el === document.activeElement), true, 'focus follows the swatch')
  pass('arrow keys move and select within a swatch group')

  const shape = page.getByRole('radio', { name: 'Shape', exact: true })
  const describedBy = await shape.getAttribute('aria-describedby')
  assert.ok(describedBy, 'a segment with a hint points at that hint')
  const hint = await page.evaluate(id => document.getElementById(id)?.textContent ?? '', describedBy)
  assert.ok(hint.includes('box layout'), 'the segment hint is its description')
  pass('a segment hint is exposed as its description')

  const svg = page.getByRole('radio', { name: 'SVG', exact: true })
  await svg.focus()
  await page.keyboard.press('ArrowRight')
  const png = page.getByRole('radio', { name: 'PNG', exact: true })
  assert.equal(await png.isChecked(), true, 'ArrowRight moves a segmented control')
  assert.equal(await png.evaluate(el => el === document.activeElement), true, 'focus follows the segment')
  await svg.focus()
  const segmentRing = await svg.evaluate(el => {
    const face = el.nextElementSibling
    const style = getComputedStyle(face)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), visible: el.matches(':focus-visible') }
  })
  assert.equal(segmentRing.visible, true, 'a focused segment matches :focus-visible')
  assert.equal(segmentRing.style, 'solid', 'the segmented control draws a focus ring on its face')
  assert.ok(segmentRing.width >= 2, `the segmented focus ring is 2px or more (${segmentRing.width})`)
  pass('arrow keys move and select within a segmented control')

  await check.focus()
  const ring = await check.evaluate(el => {
    const style = getComputedStyle(el)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset), visible: el.matches(':focus-visible') }
  })
  assert.equal(ring.visible, true, 'a focused control matches :focus-visible')
  assert.equal(ring.style, 'solid', 'the focus ring is drawn')
  assert.ok(ring.width >= 2 && ring.offset >= 1, `the focus ring is 2px or more with an offset (${ring.width}, ${ring.offset})`)
  pass('the focus ring is a visible 2px outline with an offset')
}


/** Per-option disability, read-only fields and disabled inputs follow their native state. @param {import('playwright-core').Page} page */
async function checkStates(page) {
  const shape = page.getByRole('radio', { name: 'Shape', exact: true })
  assert.equal(await shape.isDisabled(), true, 'a disabled segment option is disabled')
  const neighbouring = page.getByRole('radio', { name: 'Tree', exact: true }).first()
  const groupOpacity = await page.locator('.ui-segmented').filter({ has: neighbouring }).evaluate(el => getComputedStyle(el).opacity)
  assert.equal(groupOpacity, '1', 'a disabled option does not dim its group')
  await neighbouring.focus()
  const start = await neighbouring.isChecked()
  await page.keyboard.press('ArrowRight')
  assert.equal(await shape.isChecked(), false, 'arrow keys skip a disabled segment')
  await page.keyboard.press('ArrowLeft')
  assert.equal(await neighbouring.isChecked(), start, 'arrow keys stay on enabled segments')
  pass('disabled segment options keep their group usable')

  const custom = page.getByRole('radio', { name: 'A custom colour', exact: true })
  assert.equal(await custom.isDisabled(), true, 'a disabled swatch is disabled')
  const tile = await custom.evaluate(el => ({ opacity: getComputedStyle(el.nextElementSibling).opacity, group: getComputedStyle(el.closest('.ui-swatches')).opacity }))
  assert.ok(Number(tile.opacity) < 1, 'a disabled swatch tile is dimmed')
  assert.equal(tile.group, '1', 'a disabled swatch does not dim the group')
  pass('disabled swatches are dimmed once, inside a usable group')

  const loosed = page.getByLabel('Default layout', { exact: true }).locator('option[value="loose"]')
  assert.equal(await loosed.getAttribute('disabled') !== null, true, 'a disabled select option is disabled')
  const textarea = page.getByLabel('Read-only textarea', { exact: true })
  assert.equal(await textarea.getAttribute('readonly') !== null, true, 'the textarea is read-only')
  const readonlyBackground = await textarea.evaluate(el => getComputedStyle(el).backgroundColor)
  const sunken = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--ui-color-surface-sunken)'
    document.body.append(probe)
    const value = getComputedStyle(probe).backgroundColor
    probe.remove()
    return value
  })
  assert.equal(readonlyBackground, sunken, 'a read-only textarea takes the sunken surface')
  const colour = page.getByLabel('Disabled colour', { exact: true })
  assert.equal(await colour.isDisabled(), true, 'the colour control is disabled')
  assert.ok(Number(await colour.evaluate(el => getComputedStyle(el).opacity)) < 1, 'the disabled colour control is dimmed')
  pass('read-only and disabled fields follow their native state')
}

/** @param {import('playwright-core').Page} page */
async function checkContrast(page) {
  await page.getByLabel('Copy the outline', { exact: true }).focus()
  const results = await page.evaluate(() => {
    const parse = value => {
      const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
    }
    const luminance = rgb => {
      const [r, g, b] = rgb.map(value => {
        const c = value / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (one, two) => {
      const [a, b] = [parse(one), parse(two)]
      if (!a || !b) return 0
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
    }
    const background = el => {
      for (let node = el; node; node = node.parentElement) {
        const value = getComputedStyle(node).backgroundColor
        if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value
      }
      return getComputedStyle(document.body).backgroundColor
    }
    const one = selector => document.querySelector(selector)
    const checks = []
    const add = (name, selector, foreground, threshold, against) => {
      const el = one(selector)
      if (!el) { checks.push({ name, ratio: 0, threshold, missing: true }); return }
      const fg = foreground(el)
      const bg = against ? against(el) : background(el)
      checks.push({ name, ratio: ratio(fg, bg), threshold })
    }
    add('body text', 'body', el => getComputedStyle(el).color, 4.5)
    add('label', '.ui-label', el => getComputedStyle(el).color, 4.5)
    add('hint', '.ui-hint', el => getComputedStyle(el).color, 4.5)
    add('input border', '.ui-input', el => getComputedStyle(el).borderTopColor, 3)
    add('unchecked checkbox border', '.ui-checkbox:not(:checked):not(:disabled)', el => getComputedStyle(el).borderTopColor, 3)
    add('checked checkbox fill', '.ui-checkbox:checked:not(:disabled)', el => getComputedStyle(el).backgroundColor, 3, el => background(el.parentElement))
    add('checked checkbox mark', '.ui-checkbox:checked:not(:disabled)', el => getComputedStyle(el, '::before').borderRightColor, 4.5, el => getComputedStyle(el).backgroundColor)
    add('checked radio fill', '.ui-radio:checked', el => getComputedStyle(el).backgroundColor, 3, el => background(el.parentElement))
    add('switch track', '.ui-switch:not(:disabled)', el => getComputedStyle(el).backgroundColor, 3, el => background(el.parentElement))
    add('switch thumb', '.ui-switch:not(:disabled)', el => getComputedStyle(el, '::before').backgroundColor, 3, el => getComputedStyle(el).backgroundColor)
    add('button label', '.ui-button:not([data-variant])', el => getComputedStyle(el).color, 4.5)
    add('primary button label', '.ui-button[data-variant="primary"]', el => getComputedStyle(el).color, 4.5)
    add('danger button label', '.ui-button[data-variant="danger"]', el => getComputedStyle(el).color, 4.5)
    add('segment label', '.ui-segment > input:not(:checked) + .ui-segment-face', el => getComputedStyle(el).color, 4.5, el => background(el.closest('.ui-segmented')))
    add('invalid input border', '.ui-input[aria-invalid="true"]', el => getComputedStyle(el).borderTopColor, 3)
    add('error text', '.ui-error', el => getComputedStyle(el).color, 4.5)
    add('focus ring', '.ui-checkbox:focus-visible', el => getComputedStyle(el).outlineColor, 3)
    return checks
  })
  const failed = results.filter(check => check.missing || check.ratio < check.threshold)
  assert.deepEqual(failed, [], `contrast below target:\n${failed.map(check => `${check.name}: ${check.ratio}:1 < ${check.threshold}:1`).join('\n')}`)
  pass(`${results.length} contrast checks pass`)
}

/** @param {import('playwright-core').Page} page */
async function checkTargets(page) {
  const small = await page.evaluate(() => [...document.querySelectorAll('.ui-button, .ui-input, .ui-select, .ui-textarea, .ui-check-row, .ui-switch, .ui-segment, .ui-swatch-option, .ui-range, .ui-color')]
    .filter(el => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.height < 24
    })
    .map(el => `${el.className.split(' ')[0]}: ${Math.round(el.getBoundingClientRect().height)}px`))
  assert.deepEqual(small, [], `targets under 24px:\n${small.join('\n')}`)
  pass('every control meets the 24px target')
}

/** @param {import('playwright-core').Page} page */
async function checkSurfaces(page) {
  const shadow = await page.locator('#surfaces .ui-card').first().evaluate(el => getComputedStyle(el).boxShadow)
  assert.ok(shadow && shadow !== 'none', 'a card keeps its resting shadow')
  pass('cards keep their resting shadow')
}

/** @param {import('playwright-core').Page} page @param {'light' | 'dark'} scheme */
async function checkTheme(page, scheme) {
  const other = scheme === 'light' ? 'Dark theme' : 'Light theme'
  await page.getByRole('radio', { name: other, exact: true }).click()
  await page.waitForTimeout(200)
  const changed = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    background: getComputedStyle(document.body).backgroundColor,
  }))
  assert.equal(changed.theme, scheme === 'light' ? 'dark' : 'light', 'the theme control sets data-theme')
  assert.equal(changed.background, scheme === 'light' ? 'rgb(17, 17, 20)' : 'rgb(243, 243, 246)', 'the palette follows the chosen scheme')
  await page.getByRole('radio', { name: 'System theme', exact: true }).click()
  await page.waitForTimeout(200)
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme ?? ''), '', 'System removes data-theme')
  pass('the theme control changes the palette and returns to the system scheme')
}


/** Overlays and feedback use the same tokens and keyboard behaviour. @param {import('playwright-core').Page} page */
async function checkInteractions(page) {
  const trigger = page.getByRole('button', { name: 'Open example dialog', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Example dialog', exact: true })
  await dialog.waitFor()
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'focus moves into the dialog')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Escape returns focus to the trigger')
  pass('a dialog takes focus, closes on Escape and returns it')

  const menuTrigger = page.getByRole('button', { name: 'Example actions', exact: true })
  await menuTrigger.focus()
  await page.keyboard.press('ArrowDown')
  const menu = page.getByRole('menu', { name: 'Example actions', exact: true })
  await menu.waitFor()
  assert.match(await menu.evaluate(el => el.contains(document.activeElement) ? document.activeElement.textContent.trim() : ''), /^(Mark as reviewed|Reviewed)$/i, 'opening the menu focuses its first item')
  await page.keyboard.press('Enter')
  await page.getByRole('status', { name: 'Example review status' }).filter({ hasText: 'Reviewed.' }).waitFor()
  pass('a menu focuses its first item and Enter runs it')

  const remove = page.getByRole('button', { name: 'Remove example item', exact: true })
  await remove.click()
  const action = page.getByRole('button', { name: 'Undo removal', exact: true })
  await action.waitFor()
  await action.hover()
  await page.waitForTimeout(3200)
  assert.equal(await action.isVisible(), true, 'hovering keeps an actionable note')
  await page.mouse.move(0, 0)
  await action.click()
  assert.equal(await page.getByText('Example item is present.', { exact: true }).isVisible(), true, 'Undo runs the action')
  pass('an actionable note waits for the pointer and undoes its change')
}

try {
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await open({ scheme })
    assert.deepEqual(page.errors, [], `page errors: ${page.errors.join(', ')}`)
    await checkNames(page)
    await checkKeyboard(page)
    await checkContrast(page)
    await checkTargets(page)
    await checkSurfaces(page)
    await checkStates(page)
    await checkInteractions(page)
    await checkTheme(page, scheme)
    if (shots) await page.screenshot({ path: join(shots, `design-${scheme}.png`), fullPage: true })
    await context.close()
  }

  {
    const { context, page } = await open({ reducedMotion: 'reduce' })
    const duration = await page.evaluate(() => Math.max(
      parseFloat(getComputedStyle(document.querySelector('.ui-checkbox')).transitionDuration) || 0,
      parseFloat(getComputedStyle(document.querySelector('.ui-switch')).transitionDuration) || 0,
      parseFloat(getComputedStyle(document.querySelector('.ui-button')).transitionDuration) || 0,
    ))
    assert.ok(duration <= 0.001, `reduced motion collapses transitions (${duration}s)`)
    pass('reduced motion collapses control transitions')
    await context.close()
  }

  {
    const { context, page } = await open({ forcedColors: 'active' })
    const checkbox = page.getByLabel('Copy the outline', { exact: true })
    const before = await checkbox.isChecked()
    await checkbox.focus()
    await page.keyboard.press('Space')
    assert.equal(await checkbox.isChecked(), !before, 'the checkbox still works in forced colours')
    const visible = await checkbox.evaluate(el => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return rect.width >= 18 && rect.height >= 18 && style.borderStyle !== 'none'
    })
    assert.equal(visible, true, 'the checkbox keeps a visible boundary in forced colours')
    const faces = await page.locator('.top .ui-segment-face').evaluateAll(elements => elements.map(el => ({
      background: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    })))
    assert.notEqual(faces[0].background, faces[1].background, 'the selected segment keeps its system highlight in forced colours')
    const selectedSwatch = page.locator('.ui-swatches input:checked').first()
    await selectedSwatch.focus()
    await page.keyboard.press('Shift')
    const swatchStates = await page.evaluate(() => {
      const selected = document.querySelector('.ui-swatches input:checked + .ui-swatch-tile')
      const unselected = [...document.querySelectorAll('.ui-swatches .ui-swatch-tile')].find(tile => tile !== selected)
      if (!selected || !unselected) return null
      const s = getComputedStyle(selected), u = getComputedStyle(unselected)
      return { border: s.borderTopColor, otherBorder: u.borderTopColor, shadow: s.boxShadow, outline: parseFloat(s.outlineWidth) }
    })
    assert.ok(swatchStates, 'the swatch group is present in forced colours')
    assert.notEqual(swatchStates.border, swatchStates.otherBorder, 'the selected swatch keeps a distinct border in forced colours')
    assert.ok(swatchStates.shadow !== 'none', 'the selected swatch keeps a visible ring in forced colours')
    assert.ok(swatchStates.outline >= 2, 'the focused swatch keeps an outline in forced colours')
    // Chromium reports transparent computed pseudo-element colours for a custom range in
    // forced-colours mode even though it paints the system-colour track and thumb. The range is
    // checked visually instead of through getComputedStyle on the pseudo-elements.
    pass('controls keep their shape and behaviour in forced colours')
    await context.close()
  }
} finally {
  await browser.close()
}
