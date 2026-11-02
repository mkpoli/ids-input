// The workshop's panes at middle widths: the input panel's parts grid takes the height its parts need,
// the search under the tree fills the rest of its column, and the row's two columns end together.
// On a phone the palette keeps its own cap, and at 1280 and up the page is fixed with one scroller per
// pane. Run against a devrun server:
//   IDS_URL=http://localhost:5199 CHROMIUM_PATH=/path/to/chrome bun demo/check-workspace-layout.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const url = process.env.IDS_URL ?? 'http://localhost:5173'
/** @param {import('playwright-core').Page} page */
const panel = page => page.evaluate(() => {
  const measure = (/** @type {string} */ selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const box = el.getBoundingClientRect()
    return { top: Math.round(box.top), bottom: Math.round(box.bottom), scrolls: el.scrollHeight > el.clientHeight + 2 }
  }
  const grid = /** @type {HTMLElement} */ (document.querySelector('.parts-grid'))
  return {
    pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
    gridCap: getComputedStyle(grid).maxHeight,
    input: measure('.pane.input'),
    grid: measure('.parts-grid'),
    results: measure('.pane.results'),
    nested: [...document.querySelectorAll('.pane.input *')].filter(el => {
      const style = getComputedStyle(el)
      return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0
    }).length,
  }
})
/** @param {import('playwright-core').Page} page @param {number} width @param {number} height */
const open = async (page, width, height) => {
  await page.setViewportSize({ width, height })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator('.parts-grid .part').first().waitFor()
  await page.waitForTimeout(250)
}
try {
  const page = await browser.newPage({ viewport: { width: 1243, height: 1120 }, deviceScaleFactor: 1 })
  await open(page, 1243, 1120)
  const narrow = await panel(page)
  assert(narrow.pageScrolls, 'the page scrolls below 1280')
  assert.equal(narrow.gridCap, 'none', 'the parts grid is not capped by the palette\'s own height')
  assert(!narrow.grid?.scrolls, 'every part of the page is in the grid, not scrolled past')
  assert(Math.abs(/** @type {{bottom: number}} */ (narrow.input).bottom - /** @type {{bottom: number}} */ (narrow.results).bottom) < 2, `the input panel and the search end together: ${narrow.input?.bottom} against ${narrow.results?.bottom}`)
  assert((narrow.nested ?? 0) === 0, `nested scrollers in the input pane: ${narrow.nested}`)

  await open(page, 460, 900)
  const phone = await panel(page)
  assert.equal(phone.gridCap, '260px', 'the palette keeps its own cap on a phone')

  await open(page, 1722, 961)
  const wide = await panel(page)
  assert(!wide.pageScrolls, 'no page scroll at 1280 and up')
  assert.equal(wide.gridCap, 'none', 'the parts grid is not capped at 1280 and up')
  assert((wide.nested ?? 0) === 0, `nested scrollers in the input pane at 1280 and up: ${wide.nested}`)

  // A wrapped tools row once made the square canvas wider than the height left for it, so the tree
  // scrolled and lost the padding above and below it.
  await open(page, 1300, 800)
  const shape = await page.evaluate(() => {
    const rect = (/** @type {string} */ selector) => document.querySelector(selector)?.getBoundingClientRect()
    const box = rect('.tree-box'), tree = rect('.ids-tree'), root = rect('.ids-tree-root')
    const element = /** @type {HTMLElement | null} */ (document.querySelector('.ids-tree'))
    if (!box || !tree || !root || !element) return null
    return {
      width: box.width,
      height: box.height,
      pads: [root.left - tree.left, root.top - tree.top, tree.right - root.right, tree.bottom - root.bottom],
      threeColumns: getComputedStyle(/** @type {HTMLElement} */ (document.querySelector('.middle'))).display === 'grid',
      scrolls: element.scrollHeight > element.clientHeight + 2,
    }
  })
  assert(shape, 'the shape canvas is on the page at 1300')
  assert(shape.threeColumns, 'the three-column layout is in effect at 1300')
  assert(Math.abs(shape.width - shape.height) < 2, `the shape canvas is square: ${shape.width} against ${shape.height}`)
  const [left, top, right, bottom] = shape.pads
  assert(Math.abs(top - 16) < 1.5 && Math.abs(bottom - 16) < 1.5, `the canvas keeps its vertical padding: ${shape.pads.join(', ')}`)
  assert(left >= 15 && right >= 15, `the canvas keeps its horizontal padding: ${shape.pads.join(', ')}`)
  assert(!shape.scrolls, 'the canvas fits its box without scrolling')

  // A canvas dragged small keeps a readable floor and the pane scrolls, rather than shrinking to a dot.
  await open(page, 1280, 700)
  await page.locator('.split').focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(200)
  const small = await page.evaluate(() => {
    const box = document.querySelector('.tree-box')?.getBoundingClientRect()
    const pane = /** @type {HTMLElement | null} */ (document.querySelector('section.pane.tree'))
    return box && pane ? { width: box.width, paneScrolls: pane.scrollHeight > pane.clientHeight + 2 } : null
  })
  assert(small, 'the shape canvas is on the page when the splitter is at its minimum')
  assert(small.width >= 139, `the canvas keeps a readable floor: ${small.width}`)
  assert(small.paneScrolls, 'the pane scrolls when the canvas has no room')
  console.log('PASS the panels fill the row at middle widths, each pane scrolls once at 1280 and up, and the shape canvas keeps its padding')
} finally { await browser.close() }
