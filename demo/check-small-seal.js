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
      assert(await page.locator('.parts-grid .part').count() === 31, 'Small Seal palette has 31 mapped components')
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
      }
      assert(!page.errors.length, `Small Seal page errors: ${page.errors.join('; ')}`)
    } finally { await page.context().close() }
  }
  pass('Small Seal palette, lookup, worker search, local composition, SVG/PNG export and light/dark rendering')
}
