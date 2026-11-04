// Direct editing in the Output panel: a small part inside an enclosing one keeps its own grab area,
// and the eight handles scale one axis at a time. Run against a local dev server, with IDS_URL set:
//   IDS_URL=http://localhost:5186 CHROMIUM_PATH=/path/to/chrome bun demo/check-adjust-free.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'

const IDENTITY = [1, 0, 0, 1, 0, 0]
/** @param {number[]} outer @param {number[]} inner */
const multiply = (outer, inner) => {
  const [a, b, c, d, e, f] = outer
  const [g, h, i, j, k, l] = inner
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f]
}
/** The matrix a layer's chain applies, first operation first. @param {{ matrix?: number[] }[]} [chain] */
const flattened = chain => (chain ?? []).reduce((matrix, operation) => multiply(operation.matrix ?? IDENTITY, matrix), IDENTITY)
/** @param {number[]} matrix */
const scaleOf = matrix => ({ x: Math.hypot(matrix[0], matrix[1]), y: Math.hypot(matrix[2], matrix[3]) })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    const field = page.locator('.ids-field input')
    await field.fill('⿴囗木')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: 'Adjust layout', exact: true }).click()
    const svg = page.locator('.ids-preview-large svg[role="application"]')
    await svg.waitFor({ state: 'visible' })
    await page.waitForTimeout(500)

    const surface = await svg.boundingBox()
    assert.ok(surface, 'the preview has a drawing box')
    /** A point in the drawing's own 1000-unit coordinates. @param {number} x @param {number} y */
    const at = (x, y) => ({ x: surface.x + surface.width * x / 1000, y: surface.y + surface.height * y / 1000 })
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('ids-input:tabs') ?? '[]')[0]?.document)
    const chosenNode = async () => {
      const record = await stored()
      if (!record?.chosen) return null
      const root = record.document?.root
      if (record.chosen === root?.id) return root
      return root?.children?.find(child => child.id === record.chosen) ?? null
    }
    /** @param {{ x: number, y: number }} from @param {{ x: number, y: number }} to @param {boolean} [shift] */
    const drag = async (from, to, shift = false) => {
      if (shift) await page.keyboard.down('Shift')
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 8 })
      await page.mouse.up()
      if (shift) await page.keyboard.up('Shift')
      await page.waitForTimeout(400)
    }

    const outer = (await stored())?.document?.root?.children?.find(child => child.char === '囗')
    const inner = (await stored())?.document?.root?.children?.find(child => child.char === '木')
    assert.ok(outer && inner, 'the enclosure and its inner part are both layers')

    // An empty hole inside the enclosure chooses the enclosure, not the root that shares its box.
    await page.mouse.click(at(500, 170).x, at(500, 170).y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, outer.id, 'the empty hole of an enclosure chooses the enclosure')

    // The inner part can be chosen while the enclosing part is on top of the drawing.
    const middle = at(555, 555)
    await page.mouse.click(middle.x, middle.y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, inner.id, 'the enclosed part answers a click at its own centre')

    await page.mouse.click(at(100, 500).x, at(100, 500).y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, outer.id, 'the enclosing part is chosen outside the inner one')

    await page.mouse.click(middle.x, middle.y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, inner.id, 'the enclosed part is still reachable with the enclosure chosen')

    // The composer can paint a part past its layout box. The painted ink still belongs to the part,
    // not to the enclosure whose box holds that point.
    const overflow = await page.evaluate(id => {
      const svg = document.querySelector('.ids-preview-large svg[role="application"]')
      const group = svg?.querySelector(`[data-layer="${id}"]`)
      const grip = svg?.querySelector('.select-box')
      if (!svg || !group || !grip) return null
      const surface = svg.getBoundingClientRect()
      const numbers = (grip.getAttribute('points') ?? '').split(/[ ,]+/).map(Number)
      const quad = Array.from({ length: numbers.length / 2 }, (_, index) => [numbers[index * 2], numbers[index * 2 + 1]])
      /** @param {number} x @param {number} y */
      const inside = (x, y) => {
        let hit = false
        for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
          const [xi, yi] = quad[i], [xj, yj] = quad[j]
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit
        }
        return hit
      }
      const bounds = group.getBoundingClientRect()
      for (let y = bounds.top + 2; y < bounds.bottom - 2; y += 4) {
        for (let x = bounds.left + 2; x < bounds.right - 2; x += 4) {
          if (inside((x - surface.left) / surface.width * 1000, (y - surface.top) / surface.height * 1000)) continue
          const element = document.elementFromPoint(x, y)
          if (element?.closest?.('[data-layer]') === group) return { x, y }
        }
      }
      return null
    }, inner.id)
    assert.ok(overflow, 'the inner part paints outside its layout box')
    await page.mouse.click(at(100, 500).x, at(100, 500).y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, outer.id, 'the enclosure is chosen before the overflow click')
    await page.mouse.click(overflow.x, overflow.y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, inner.id, 'ink outside the layout box still chooses its own part')
    await page.mouse.click(middle.x, middle.y)
    await page.waitForTimeout(300)

    // The enclosing part moves by its own outline, and the part inside it still answers at its
    // moved place and moves by the pointer's own delta.
    const border = at(100, 500)
    await page.mouse.click(border.x, border.y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, outer.id, 'the enclosure is chosen again for its own move')
    await drag(border, { x: border.x + 30, y: border.y + 12 })
    const moved = (await stored())?.document?.root?.children?.find(child => child.char === '囗')?.transform
    assert.ok(moved?.length, 'dragging the enclosure writes its transform')
    const enclosure = JSON.stringify(moved)

    const shifted = { x: middle.x + 30, y: middle.y + 12 }
    await page.mouse.click(shifted.x, shifted.y)
    await page.waitForTimeout(300)
    assert.equal((await stored())?.chosen, inner.id, 'the enclosed part is reachable under a moved enclosure')
    await drag(shifted, { x: shifted.x + 40, y: shifted.y + 10 })
    assert.ok((await chosenNode())?.transform?.length, 'dragging the part writes its transform')
    assert.equal(JSON.stringify((await stored())?.document?.root?.children?.find(child => child.char === '囗')?.transform), enclosure, 'the enclosing part keeps its own transform')

    // An east handle changes width only.
    const before = scaleOf(flattened((await chosenNode())?.transform))
    const east = await page.locator('.ids-preview-large .handle.resize.e .handle-hit').boundingBox()
    assert.ok(east, 'the east resize handle exists')
    await drag({ x: east.x + east.width / 2, y: east.y + east.height / 2 }, { x: east.x + east.width / 2 + 40, y: east.y + east.height / 2 })
    const wider = scaleOf(flattened((await chosenNode())?.transform))
    assert.ok(wider.x > before.x + 0.05, 'the east handle widens the layer')
    assert.ok(Math.abs(wider.y - before.y) < 0.005, 'the east handle keeps the height')

    // A south handle changes height only.
    const beforeHeight = scaleOf(flattened((await chosenNode())?.transform))
    const south = await page.locator('.ids-preview-large .handle.resize.s .handle-hit').boundingBox()
    assert.ok(south, 'the south resize handle exists')
    await drag({ x: south.x + south.width / 2, y: south.y + south.height / 2 }, { x: south.x + south.width / 2, y: south.y + south.height / 2 + 40 })
    const taller = scaleOf(flattened((await chosenNode())?.transform))
    assert.ok(taller.y > beforeHeight.y + 0.05, 'the south handle heightens the layer')
    assert.ok(Math.abs(taller.x - beforeHeight.x) < 0.005, 'the south handle keeps the width')

    // Shift makes a corner scale evenly.
    await page.getByRole('button', { name: 'Reset part', exact: true }).click()
    await page.waitForTimeout(400)
    const corner = await page.locator('.ids-preview-large .handle.resize.se .handle-hit').boundingBox()
    assert.ok(corner, 'the corner resize handle exists')
    await drag({ x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, { x: corner.x + corner.width / 2 + 35, y: corner.y + corner.height / 2 + 25 }, true)
    const even = scaleOf(flattened((await chosenNode())?.transform))
    assert.ok(even.x > 1.05 && Math.abs(even.x - even.y) < 1e-3, 'Shift keeps the corner scale even')

    // An off-centre grab scales from the handle's own corner, so the edge follows the pointer
    // instead of measuring the ratio from the grab point.
    await page.getByRole('button', { name: 'Reset part', exact: true }).click()
    await page.waitForTimeout(400)
    const box = await svg.boundingBox()
    assert.ok(box, 'the preview has a drawing box')
    const eastGrip = await page.locator('.ids-preview-large .handle.resize.e .handle-hit').boundingBox()
    const westGrip = await page.locator('.ids-preview-large .handle.resize.w .handle-hit').boundingBox()
    assert.ok(eastGrip && westGrip, 'both east and west handles are there')
    // The two centre handles stand one local 1000 units apart, so their screen distance is the
    // scale that turns a pointer delta into the layer's own units.
    const span = Math.hypot(eastGrip.x + eastGrip.width / 2 - (westGrip.x + westGrip.width / 2), eastGrip.y + eastGrip.height / 2 - (westGrip.y + westGrip.height / 2))
    const grab = { x: eastGrip.x + eastGrip.width * 0.9, y: eastGrip.y + eastGrip.height / 2 }
    await drag(grab, { x: grab.x + 60, y: grab.y })
    const offCentre = scaleOf(flattened((await chosenNode())?.transform))
    const expected = 1 + 60 / span
    assert.ok(Math.abs(offCentre.x - expected) < 0.01, `an off-centre grab scales by the pointer (${offCentre.x.toFixed(3)} vs ${expected.toFixed(3)})`)
    assert.ok(Math.abs(offCentre.y - 1) < 0.005, 'an off-centre east grab keeps the height')

    // The turn grip turns the layer.
    await page.getByRole('button', { name: 'Reset part', exact: true }).click()
    await page.waitForTimeout(400)
    const turn = await page.locator('.ids-preview-large .handle.rotate .handle-hit').boundingBox()
    assert.ok(turn, 'the turn handle exists')
    await drag({ x: turn.x + turn.width / 2, y: turn.y + turn.height / 2 }, { x: turn.x + turn.width / 2 + 60, y: turn.y + turn.height / 2 + 40 })
    const turned = flattened((await chosenNode())?.transform)
    assert.ok(Math.abs(turned[1]) > 0.05, 'the turn handle rotates the layer')

    if (process.env.IDS_ADJUST_FREE_SHOTS) {
      mkdirSync(process.env.IDS_ADJUST_FREE_SHOTS, { recursive: true })
      await page.locator('.ids-preview').screenshot({ path: `${process.env.IDS_ADJUST_FREE_SHOTS}/adjust-free-${scheme}.png` })
    }

    // A part two operators deep must follow the pointer exactly, in canvas units.
    await page.goto(process.env.IDS_URL ?? 'http://localhost:5186', { waitUntil: 'domcontentloaded' })
    await field.fill('⿱⿰木木⿰木木')
    await field.press('Tab')
    await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: 'Adjust layout', exact: true }).click()
    const deepSvg = page.locator('.ids-preview-large svg[role="application"]')
    await deepSvg.waitFor({ state: 'visible' })
    await page.waitForTimeout(500)
    const deepSurface = await deepSvg.boundingBox()
    assert.ok(deepSurface, 'the nested preview has a drawing box')
    /** @param {string} points */
    const corners = points => {
      const numbers = points.split(/[ ,]+/).map(Number)
      return Array.from({ length: numbers.length / 2 }, (_, index) => [numbers[index * 2], numbers[index * 2 + 1]])
    }
    /** @param {number[][]} points */
    const centroid = points => points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0])
    const topLeft = { x: deepSurface.x + deepSurface.width * 0.25, y: deepSurface.y + deepSurface.height * 0.25 }
    await page.mouse.click(topLeft.x, topLeft.y)
    await page.waitForTimeout(400)
    const beforePoints = corners(await page.locator('.select-box').getAttribute('points') ?? '')
    await page.mouse.move(topLeft.x, topLeft.y)
    await page.mouse.down()
    await page.mouse.move(topLeft.x + 40, topLeft.y + 10, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    const afterPoints = corners(await page.locator('.select-box').getAttribute('points') ?? '')
    const [beforeX, beforeY] = centroid(beforePoints), [afterX, afterY] = centroid(afterPoints)
    const pixels = deepSurface.width / 1000
    assert.ok(Math.abs((afterX - beforeX) * pixels - 40) < 1, 'a nested part moves 40 pixels under a 40-pixel drag')
    assert.ok(Math.abs((afterY - beforeY) * pixels - 10) < 1, 'a nested part moves 10 pixels under a 10-pixel drag')

    assert.deepEqual(errors, [])
    console.log(`PASS ${scheme}: enclosed parts move directly, each handle scales one axis, nested drags track the pointer`)
    await page.close()
  }
} finally {
  await browser.close()
}
