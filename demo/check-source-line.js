// The character card's source line: every record it cites is a link to what it cites, one per kind,
// in the order the card builds them, and the character's page on zi.tools comes last. Run against a
// devrun server: IDS_URL, CHROMIUM_PATH.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5186'}/?lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const field = page.locator('.ids-field input'), card = page.locator('.ids-character-info')
  const links = () => card.locator('.sources a').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent.trim(), href: node.getAttribute('href'), title: node.title })))
  await field.fill('⿰馬𘥇'); await field.press('Tab')
  const component = page.locator('.ids-tree [data-character="𘥇"]').first()
  await component.hover(); await card.locator('.sources a').first().waitFor()
  // A Tangut component: his association post, the aids, Open Tangut, the list of its examples, and
  // the character's page on zi.tools.
  const rows = await links()
  assert.deepEqual(rows.map(row => row.text), ['Andrew West', 'Editorial aids', 'Open Tangut', 'Tangut IDS list', 'zi.tools'])
  assert.match(rows[0].href, /^https:\/\/www\.babelstone\.co\.uk\/TangutSea\/.*#Status_/, 'his post is where the association is recorded')
  assert.match(rows[0].title, /@TangutSea/, 'the link names the record it opens')
  assert.equal(rows[1].href, 'https://github.com/mkpoli/ids-input/blob/main/data/README.md#character-information-panels')
  assert.equal(rows[2].href, 'https://github.com/imlooh/open-tangut', 'the merged dictionary the examples are glossed from')
  assert.equal(rows[3].href, 'https://www.babelstone.co.uk/Tangut/TangutIDS.txt')
  assert.equal(rows[4].href, 'https://zi.tools/zi/%F0%98%A5%87', 'the Tangut component on zi.tools')
  assert.deepEqual(errors, [])
  // One line of links: each is a link, in the card's own small text, and none carries an arrow icon.
  assert.equal(await card.locator('.sources a[href]').count(), 5)
  assert.equal(await card.locator('.sources .chip-icon, .sources svg').count(), 0, 'a source is a plain link')
  // A Han character translated to Tangut: the translation names the Tangut record's site.
  await page.keyboard.press('Escape')
  await field.fill('馬'); await field.press('Tab')
  await page.locator('.ids-tree [data-character="馬"]').first().hover()
  await card.locator('.sources a').first().waitFor()
  const han = await links()
  assert.ok(han.some(row => row.text === 'Open Tangut' && row.href === 'https://github.com/imlooh/open-tangut'), JSON.stringify(han))
  assert.ok(!han.some(row => row.text === 'Tangut IDS list'), 'the list describes a component’s examples, not a Han card')
  // The page on zi.tools ends the line, whatever records the character has.
  assert.deepEqual(han.at(-1), { text: 'zi.tools', href: 'https://zi.tools/zi/%E9%A6%AC', title: 'zi.tools' }, JSON.stringify(han))
  // Two Unicode records share a site, so each link says what it adds rather than saying "Unicode" twice.
  const unicode = han.filter(row => row.text.startsWith('Unicode · '))
  assert.equal(unicode.length, 2, JSON.stringify(han))
  assert.equal(new Set(unicode.map(row => row.text)).size, 2, 'the two rows read differently')
  assert.ok(unicode.some(row => row.href.endsWith('/UnicodeData.txt')), JSON.stringify(unicode))
  assert.ok(unicode.some(row => row.href.endsWith('/EquivalentUnifiedIdeograph.txt')), JSON.stringify(unicode))
  assert.deepEqual(errors, [])
  console.log('PASS source line: one link per source, each to the record it cites')
} finally { await browser.close() }
