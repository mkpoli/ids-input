import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Browser coverage for the bundled Small Seal subset. */
export async function checkSmallSeal({ open, shots, assert, pass }) {
  const jade = String.fromCodePoint(0x3D06D), seal = String.fromCodePoint(0x3D10C)
  const sequence = `⿰${jade}${jade}`
  for (const scheme of ['light', 'dark']) {
    const page = await open(`?composer=${encodeURIComponent('http://[')}#${encodeURIComponent(sequence)}`, { scheme })
    try {
      await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 15000 })
      await page.getByRole('tab', { name: 'Parts', exact: true }).click()
      await page.getByRole('tab', { name: 'Small Seal', exact: true }).click()
      await page.locator('.parts-grid .part').first().waitFor()
      assert(await page.locator('.parts-grid .part').count() === 138, 'Small Seal opens on the basic selection')
      const palette = page.locator('.ids-parts[role="group"]')
      const paletteShot = async name => {
        const box = await palette.boundingBox()
        await page.screenshot({ path: join(shots, name), clip: { ...box, height: Math.min(box.height, page.viewportSize().height - box.y - 8) } })
      }
      await paletteShot(`seal-palette-basic-${scheme}.png`)
      await palette.getByRole('button', { name: /^Compound / }).click()
      assert(await palette.locator('.parts-grid .part').count() === 1172, 'Compound forms are separated')
      assert(await palette.locator('.seal-estimate').count() > 300, 'CJK-inferred classifications are marked')
      await paletteShot(`seal-palette-compound-${scheme}.png`)
      await palette.getByRole('button', { name: /^Other / }).click()
      assert(await palette.locator('.parts-grid .part').count() === 24, 'Unclassified forms are kept separately')
      await palette.locator('.parts-filter').fill('口')
      assert(await palette.locator('.part').count() === 1, 'Modern CJK filters across seal groups')
      const mouth = await palette.locator('.part').textContent()
      assert([...mouth.trim()].length === 1, 'Seal filter returns a seal glyph')
      await palette.locator('.parts-filter').fill('木水人')
      assert(await palette.locator('.part').count() === 3, 'Basic parts outside the old IDS subset are available')
      await palette.locator('.parts-filter').fill('')
      await palette.getByRole('button', { name: /^Basic / }).click()
      assert(await page.evaluate(async text => (await document.fonts.load('22px "IDS Seal"', text)).length > 0, jade), 'Small Seal webfont loads')
      await page.locator('.ids-search-results .hit .open').filter({ hasText: seal }).waitFor({ timeout: 15000 })
      await page.locator('.ids-search-results .hit .open').filter({ hasText: '玨' }).waitFor({ timeout: 15000 })
      const ink = await page.locator('.ids-preview-large .ink').getAttribute('d')
      assert(ink.length > 100, 'Small Seal has real outlines without a Han export')
      // The complete three-column editor is the changed area; capture it at 2× in both themes.
      await page.locator('.work').screenshot({ path: join(shots, `small-seal-${scheme}.png`) })
      await page.locator('.ids-field input').fill('⿰玉玉')
      await page.locator('.ids-search-results .hit .open').filter({ hasText: seal }).waitFor({ timeout: 15000 })
      await page.locator('.work').screenshot({ path: join(shots, `seal-cross-search-${scheme}.png`) })
      await page.locator('.ids-field input').fill(sequence)
      await page.locator('.ids-preview[data-step="composed"]').waitFor({ timeout: 15000 })
      if (scheme === 'light') {
        const [svg] = await Promise.all([page.waitForEvent('download'), page.locator('.export .primary').click()])
        const exported = readFileSync(await svg.path(), 'utf8')
        assert(exported.includes(ink) && !exported.includes('<text'), 'Small Seal SVG exports outlines')
        await page.locator('.export [role="radio"]', { hasText: 'PNG' }).click()
        const [png] = await Promise.all([page.waitForEvent('download'), page.locator('.export .primary').click()])
        assert(readFileSync(await png.path()).readUInt32BE(16) === 1024, 'Small Seal PNG is 1024 px')
        await page.locator('.ids-field input').fill(`⿱${jade}⬚`)
        await page.locator('.ids-preview[data-step="composed"] .slot:not(.faint)').first().waitFor()
        await page.getByRole('tab', { name: 'Find', exact: true }).click()
        await page.locator('.ids-find input').fill('玨')
        await page.locator('.ids-found .ids-hit').filter({ hasText: seal }).waitFor()
        await page.locator('.ids-find input').fill('U+3D10C')
        await page.locator('.ids-found .ids-hit').filter({ hasText: '珏' }).waitFor()
        await page.getByRole('tab', { name: 'Take parts from', exact: true }).click()
        await page.locator('.from-field input').fill(seal)
        await page.waitForFunction(text => document.querySelector('.ids-from')?.textContent?.includes(text), jade)
        await page.getByRole('tab', { name: 'Parts', exact: true }).click()
        await palette.locator('.parts-filter').fill('木')
        const wood = (await palette.locator('.part').textContent()).trim()
        await page.locator('.ids-field input').fill('⿰⬚⬚')
        await palette.locator('.part').click()
        await page.waitForFunction(char => document.querySelector('.ids-field input').value.includes(char), wood)
        await page.locator('.ids-preview[data-step="composed"] .slot:not(.faint)').first().waitFor()
      }
      assert(!page.errors.length, `Small Seal page errors: ${page.errors.join('; ')}`)
    } finally { await page.context().close() }
  }
  pass('Small Seal palette, lookup, worker search, local composition, SVG/PNG export and light/dark rendering')
}
