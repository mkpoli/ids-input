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
    await page.waitForTimeout(300)
    return {
      meta: (await page.locator('.ids-preview-meta').textContent())?.trim().replace(/\s+/g, ' ') ?? '',
      ink: await page.locator('.ids-preview .ink').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')).join('|')),
    }
  }
  // A description the composer does not know draws the character it names, not its own layout.
  for (const [sequence, char, code] of [['㇯上一', '丄', 'U+4E04'], ['⿿亚', '𠀜', 'U+2001C']]) {
    const described = await read(sequence, code), typed = await read(char, 'Preview')
    assert.ok(!/Approximate/.test(described.meta), `${sequence} is still approximate: ${described.meta}`)
    assert.equal(described.ink, typed.ink, `${sequence} does not draw ${char}`)
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
