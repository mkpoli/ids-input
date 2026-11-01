// What a dispatched report needs before the issue can be filed: the site behind the reporter, asked
// for the drawing it showed. Everything that can be judged without the network (the origin, the
// multipart, the fields, the image) is settled first, so a request that cannot become a report never
// reaches the site.

import { parseReport } from '../src/validate.js'

/** The field the dialog's share link rides in; the drawing is read from the page it names. */
const LINK = 'link'

/** The drawing: its bytes, as base64, for the step that commits them. */
/** @typedef {{ data: string }} Drawing */

/**
 * @typedef {{ ok: true, report: import('../src/validate.js').Report, drawing: Drawing | null }} AcceptedReport
 * @typedef {{ ok: false, status: number, body: string }} RefusedReport
 */

/** @param {number} status @param {string} error @param {string} message @returns {RefusedReport} */
const refuse = (status, error, message) => ({ ok: false, status, body: `${JSON.stringify({ error, message })}\n` })

/**
 * Read a report from the form the dispatch carried, with the drawing taken from the site it
 * reports on.
 * @param {{ origin: string, form: FormData }} posted the report as the dispatch carried it
 * @param {{ allow: (origin: string) => boolean }} options which origins the dialog may be served from
 * @returns {Promise<AcceptedReport | RefusedReport>}
 */
export async function intake({ origin, form }, { allow }) {
  // The report may only be served from the workshop; what it names is read from that origin alone.
  if (origin && !allow(origin)) return refuse(403, 'forbidden_origin', 'Reports are only accepted from the workshop.')

  const offered = form.get(LINK)
  const link = typeof offered === 'string' ? offered.trim() : ''
  const site = siteOf(link)
  // The page is opened in a browser of this run, so it has to be the workshop's own.
  if (!site || !allow(site.origin)) return refuse(400, 'invalid_request', 'A report needs the share link of the page it was sent from.')

  const parsed = await parseReport(form, { siteOrigin: site.origin })
  if (!parsed.ok) return refuse(parsed.status, parsed.error, parsed.message)

  /** @type {Drawing | null} */
  let drawing = null
  // A report without its drawing is still worth filing; the body then says the drawing is gone.
  if (parsed.report.image) drawing = await capture(site).catch(error => {
    console.error('the drawing was not taken', error)
    return null
  })
  return { ok: true, report: parsed.report, drawing }
}

/** The URL a link names, for http and https only. @param {string} link @returns {URL | null} */
function siteOf(link) {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/**
 * Open the reported page and photograph the drawing on it. The page opens at the sequence in the
 * dialog's share link, so the tab shows the drawing the reporter was looking at.
 * @param {URL} site @returns {Promise<Drawing>}
 */
async function capture(site) {
  // The in-process API of `playwright-core`, which is how its own CLI reaches the browser; the
  // package exports only the client.
  const { inprocess } = await import('playwright-core/lib/coreBundle')
  const chromium = /** @type {any} */ (/** @type {any} */ (inprocess).playwright).chromium
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    await page.goto(site.href, { waitUntil: 'domcontentloaded' })
    // The drawing waits for the composer, and then for the faces to arrive.
    const preview = page.locator('#output-panel .ids-preview').first()
    await preview.waitFor({ state: 'attached', timeout: 90_000 })
    await page.locator('.ids-preview:is([data-step="composed"], [data-step="idle"])').first().waitFor({ state: 'attached', timeout: 90_000 })
    await page.waitForTimeout(2_000)
    const image = /** @type {Buffer} */ (await preview.screenshot())
    return { data: image.toString('base64') }
  } finally {
    await browser.close()
  }
}
