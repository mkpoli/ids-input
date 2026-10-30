// Run against a local devrun server with IDS_URL, and IDS_COMPOSER to a composer export (the fixture
// in tests/fixtures, so the check does not wait on the live one); `--shots <dir>` or IDS_REPORT_SHOTS saves
// screenshots. The report dialog is filled and submitted against an intercepted intake, so the
// multipart body itself is read back: the sequence, the context and the PNG of the drawing.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'

const flag = process.argv.indexOf('--shots')
const shots = flag > -1 ? process.argv[flag + 1] : process.env.IDS_REPORT_SHOTS
if (shots) mkdirSync(shots, { recursive: true })
const base = process.env.IDS_URL ?? 'http://localhost:5186'
const INTAKE = 'https://report.invalid/intake'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })

/** The multipart body as its parts, by field name: a file keeps its bytes, a field its text.
 *  @param {Buffer} body */
function parts(body) {
  /** @type {Record<string, { filename?: string, type?: string, value: string }>} */
  const found = {}
  // The bytes map one to one onto latin1, so a PNG survives the split; text fields are decoded after.
  for (const chunk of body.toString('latin1').split(/--[-\w]+/)) {
    const match = /name="([^"]+)"(?:; filename="([^"]*)")?\r?\n(?:Content-Type: ([^\r\n]+)\r?\n)?\r?\n([\s\S]*?)\r?\n$/.exec(chunk)
    if (!match) continue
    const value = match[2] === undefined ? Buffer.from(match[4], 'latin1').toString('utf8') : match[4]
    found[match[1]] = { filename: match[2], type: match[3], value }
  }
  return found
}

/** @param {import('playwright-core').Page} page @param {string} name */
const shoot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }) }

/**
 * Open the workshop with the dialog ready and the intake intercepted.
 * @param {{ width: number, height: number }} viewport @param {'light' | 'dark'} scheme @param {boolean} deepLink
 * @param {string} [sequence] the path, an encoded sequence by default
 * @param {boolean} [clean] forget the workspace a previous case left in storage
 */
async function open(viewport, scheme, deepLink = false, sequence = '%E2%BF%B0%E6%9C%A8%E5%8F%A3', clean = false) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme: scheme })
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  /** @type {Buffer | null} */
  let sent = null
  await page.route(INTAKE, async route => {
    sent = route.request().postDataBuffer() ?? Buffer.alloc(0)
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ number: 123, url: 'https://github.com/mkpoli/ids-input/issues/123', duplicate: false }) })
  })
  if (clean) await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear() })
  const address = `${base}/${sequence}?endpoint=${encodeURIComponent(INTAKE)}${deepLink ? '&report=1' : ''}${process.env.IDS_COMPOSER ? `&composer=${encodeURIComponent(process.env.IDS_COMPOSER)}` : ''}`
  await page.goto(address, { waitUntil: 'domcontentloaded' })
  await page.locator('.ids-preview:is([data-step="composed"], [data-step="idle"])').waitFor({ timeout: 30000 })
  return { page, errors, body: () => sent ?? Buffer.alloc(0) }
}

try {
  const { page, errors, body } = await open({ width: 1440, height: 900 }, 'light')
  // What the page said before the report is carried with it, with nothing of the reporter's own
  // machine in it, and a page that wraps the ring and calls it back does not loop.
  await page.evaluate(() => {
    const outer = console.error
    console.error = (...args) => outer(...args)
    console.error('a part could not be drawn from http://localhost:5186/@fs/home/someone/secret.js?token=abc')
  })
  // The File menu opens it.
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Report a problem', exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Report a problem' }) })
  await dialog.waitFor({ timeout: 5000 })
  const account = dialog.locator('textarea')
  assert.equal(await account.evaluate(el => el === document.activeElement), true, 'the account of the problem has the focus')
  await account.fill('The enclosure sits too low in ⿰木口.')
  await dialog.getByRole('textbox', { name: 'How to reach you (optional)' }).fill('@someone')
  assert.equal(await dialog.getByRole('checkbox', { name: 'Attach the drawing' }).isChecked(), true, 'the drawing goes along by default')
  assert.ok((await dialog.textContent())?.includes('⿰木口'), 'the dialog says which sequence goes along')
  await shoot(page, 'report-desktop-light')
  await dialog.getByRole('button', { name: 'Send report' }).click()
  await dialog.getByRole('link', { name: 'Issue #123' }).waitFor({ timeout: 10000 })
  assert.ok((await dialog.textContent())?.includes('#123'), 'the issue it became is shown')
  assert.ok((await dialog.textContent())?.includes('Thank you'), 'and a line thanking the reporter')
  await shoot(page, 'report-desktop-light-sent')

  const sent = parts(body())
  assert.equal(sent.symptom?.value, 'The enclosure sits too low in ⿰木口.', 'the account is sent')
  assert.equal(sent.sequence?.value, '⿰木口', 'the sequence is sent')
  assert.equal(sent.contact?.value, '@someone', 'the contact is sent')
  assert.ok(sent.link?.value.includes('%E2%BF%B0%E6%9C%A8%E5%8F%A3'), `the share link is sent: ${sent.link?.value}`)
  assert.ok(!/localhost|127\.0\.0\.1/.test(sent.link?.value ?? ''), `and names no local host: ${sent.link?.value}`)
  const context = JSON.parse(sent.context?.value ?? 'null')
  assert.ok(context && Object.keys(context).length > 8, 'the context is not empty')
  assert.ok(context.appVersion && context.commit, 'with the version and the build commit')
  assert.match(context.preview, /^composed/, `the preview says how the drawing went: ${context.preview}`)
  assert.equal(context.devicePixelRatio, 2, 'the pixel ratio')
  assert.ok(context.composerBase, 'and the composer the preview draws from')
  assert.equal(context.route, '/%E2%BF%B0%E6%9C%A8%E5%8F%A3', 'the route carries no query')
  assert.equal(context.console?.at(-1)?.text, 'a part could not be drawn from (local)', 'and the console ring, with the reporter\'s own machine taken out')
  assert.equal(context.console.at(-1).level, 'error', 'with the level it was said at')
  assert.ok(context.console.at(-1).at > 0, 'and the second it was said at')
  const workspace = JSON.parse(sent.document?.value ?? 'null')
  assert.equal(workspace?.tabs?.[0]?.sequence, '⿰木口', 'the workspace is sent')
  assert.equal(sent.image?.type, 'image/png', 'the drawing is sent as a PNG')
  assert.ok(sent.image.value.startsWith('\x89PNG'), 'and it is a PNG')
  assert.ok(sent.image.value.length > 1000, `of some size: ${sent.image.value.length}`)
  assert.deepEqual(errors, [])
  await page.close()

  // `?report=1` opens the dialog on arrival; a refused report keeps the text and says why.
  const deep = await open({ width: 1440, height: 900 }, 'dark', true)
  const deepDialog = deep.page.getByRole('dialog').filter({ has: deep.page.getByRole('heading', { name: 'Report a problem' }) })
  await deepDialog.waitFor({ timeout: 10000 })
  await deepDialog.locator('textarea').fill('The preview stays blank.')
  await shoot(deep.page, 'report-desktop-dark')
  await deep.page.unroute(INTAKE)
  await deep.page.route(INTAKE, route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad_request', message: 'Say a little more about what happened.' }) }))
  await deepDialog.getByRole('button', { name: 'Send report' }).click()
  await deepDialog.getByText('Say a little more about what happened.').waitFor({ timeout: 10000 })
  assert.equal(await deepDialog.locator('textarea').inputValue(), 'The preview stays blank.', 'a refused report keeps its text')
  await deepDialog.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 5000 })
  assert.deepEqual(deep.errors, [])
  await deep.page.close()

  // The More sheet holds it on a phone.
  const phone = await open({ width: 390, height: 844 }, 'dark')
  await phone.page.getByRole('button', { name: 'Menu', exact: true }).click()
  await phone.page.getByRole('button', { name: 'Report a problem', exact: true }).first().click()
  const phoneDialog = phone.page.getByRole('dialog').filter({ has: phone.page.getByRole('heading', { name: 'Report a problem' }) })
  await phoneDialog.waitFor({ timeout: 5000 })
  await phoneDialog.locator('textarea').fill('水 draws over its enclosure on my phone.')
  await shoot(phone.page, 'report-phone-dark')
  await phoneDialog.getByRole('button', { name: 'Send report' }).click()
  await phoneDialog.getByRole('link', { name: 'Issue #123' }).waitFor({ timeout: 10000 })
  await shoot(phone.page, 'report-phone-dark-sent')
  assert.ok(parts(phone.body()).image, 'the phone report carries the drawing too')
  assert.deepEqual(phone.errors, [])
  await phone.page.close()

  // A new, empty tab: the intake is told there is no sequence, and the dialog does not wait for a
  // drawing that never comes.
  const bare = await open({ width: 1440, height: 900 }, 'light', false, '', true)
  await bare.page.getByRole('button', { name: 'New tab', exact: true }).click()
  await bare.page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await bare.page.getByRole('menuitem', { name: 'Report a problem', exact: true }).click()
  const bareDialog = bare.page.getByRole('dialog').filter({ has: bare.page.getByRole('heading', { name: 'Report a problem' }) })
  await bareDialog.waitFor({ timeout: 5000 })
  await bareDialog.locator('textarea').fill('Nothing opens at all.')
  const at = Date.now()
  await bareDialog.getByRole('button', { name: 'Send report' }).click()
  await bareDialog.getByRole('link', { name: 'Issue #123' }).waitFor({ timeout: 10000 })
  assert.ok(Date.now() - at < 4000, `an empty tab sends without waiting on a drawing: ${Date.now() - at} ms`)
  assert.ok(!parts(bare.body()).sequence, `an empty tab reports no sequence: ${JSON.stringify(parts(bare.body()).sequence)}`)
  assert.deepEqual(bare.errors, [])
  await bare.page.close()

  console.log('PASS the report dialog opens from File, the More sheet and ?report=1, sends the sequence, the workspace, the context and the drawing, shows the issue it became, and keeps the text when the intake refuses it')
} finally { await browser.close() }
