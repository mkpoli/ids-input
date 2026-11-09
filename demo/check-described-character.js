// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-described-character.js
// A description that names a character draws that character; one that names none keeps the guess.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.IDS_URL ?? 'http://localhost:5173', { waitUntil: 'domcontentloaded' })
  const field = page.locator('.ids-field input')
  await field.waitFor()
  // The composer and the description table load behind the first paint.
  await page.waitForFunction(() => (document.querySelector('.ids-preview-meta')?.textContent ?? '').trim().length > 0)
  await page.waitForTimeout(1500)
  /**
   * The preview for `sequence`, once its meta shows `expect` (a code point or the badge).
   * @param {string} sequence @param {string} expect
   */
  const read = async (sequence, expect) => {
    await field.fill(sequence)
    // A fill that lands before the app's listener is attached is read again here.
    await field.dispatchEvent('input')
    await page.waitForFunction(text => (document.querySelector('.ids-preview-meta')?.textContent ?? '').includes(text), expect, { timeout: 30000 })
    // The meta names the character before the drawing is done; the drawing follows the sketch.
    await page.waitForFunction(() => document.querySelector('.ids-preview')?.dataset.step !== 'loading', null, { timeout: 60000 })
    await page.waitForTimeout(300)
    // The drawing is one `ink` path, or the paths of the document group the layer view draws it in.
    let last = '', ink = []
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(300)
      ink = await page.locator('.ids-preview-large svg path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? '').filter(Boolean))
      const seen = JSON.stringify(ink)
      if (seen !== '[]' && seen === last) break
      last = seen
    }
    return { meta: (await page.locator('.ids-preview-meta').textContent())?.trim().replace(/\s+/g, ' ') ?? '', ink }
  }
  /**
   * Whether two drawings are the same ink: the same commands over the same points. A description and
   * the character it names are drawn by different routes, so a point may land a unit or two away, and
   * the engine writes its numbers to three decimals; neither changes the drawing.
   * @param {string[]} a @param {string[]} b
   */
  const sameInk = (a, b) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const left = a[i].match(/[MLQCZ][^MLQCZ]*/g) ?? [], right = b[i].match(/[MLQCZ][^MLQCZ]*/g) ?? []
      if (left.length !== right.length) return false
      for (let j = 0; j < left.length; j++) {
        const numbers = text => text.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number)
        const [l, r] = [numbers(left[j]), numbers(right[j])]
        if (left[j][0] !== right[j][0] || l.length !== r.length) return false
        if (!l.every((value, k) => Math.abs(value - r[k]) <= 3)) return false
      }
    }
    return true
  }
  // A description the composer does not know draws the character it names, not its own layout.
  for (const [sequence, char, code] of [['㇯上一', '丄', 'U+4E04'], ['⿿亚', '𠀜', 'U+2001C']]) {
    const described = await read(sequence, code), typed = await read(char, 'Preview')
    assert.ok(!/Approximate/.test(described.meta), `${sequence} is still approximate: ${described.meta}`)
    assert.ok(sameInk(described.ink, typed.ink), `${sequence} does not draw ${char}`)
  }
  // A common character may come from a prepared example; the description still draws that character.
  const common = await read('⿰木木', 'U+6797')
  assert.ok(!/Approximate/.test(common.meta), common.meta)
  // A description naming no character keeps the composer's guess, and says so.
  assert.match((await read('⿽力丶', 'Approximate')).meta, /Approximate/)
  // A modifier whose tagged description is not in the table is a guess too.
  assert.match((await read('⿻[3:]丨日', 'Approximate')).meta, /Approximate/)
  assert.deepEqual(errors, [])
  console.log('PASS a description draws the character it names, and only guesses when it names none')
} finally { await browser.close() }
