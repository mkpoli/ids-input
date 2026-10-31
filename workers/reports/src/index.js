// @ts-check
// The intake endpoint. `POST /` takes a report as multipart form data and answers with the GitHub
// issue it became; `GET /health` answers that the Worker is up. Reporters have no account anywhere,
// so the only thing standing between the endpoint and abuse is the origin check, the rate limits
// and the optional Turnstile challenge.
import { duplicateComment, issueBody, issueTitle, labelsFor } from './issue.js'
import { GitHubError, commentOnIssue, createIssue, ensureLabels, rawUrl, uploadAttachments } from './github.js'
import { MAX_BODY, checkBodySize, checkMediaType, meterBody, parseReport } from './validate.js'
import { checkRate, dedupeKey, findDuplicate, rememberIssue } from './limit.js'

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** @typedef {import('./validate.js').Report} Report */
/**
 * @typedef {object} Env
 * @property {KVNamespace} REPORTS
 * @property {string} REPO
 * @property {string} SITE_ORIGIN
 * @property {string} GITHUB_TOKEN
 * @property {string} [TURNSTILE_SECRET]
 */

/** A preview version of the workshop, on the alias its pull request deploys to. */
const PREVIEW = /^https:\/\/(?:[a-z0-9-]+-)?ids-input-workshop\.mkpoli\.workers\.dev$/

/**
 * Whether an origin may talk to the endpoint: the site itself, a preview of it, or any port of
 * localhost for a developer running the workshop. A request without an `Origin` header is not a
 * browser's and is left alone.
 * @param {string | null} origin @param {string} siteOrigin @returns {boolean}
 */
export function originAllowed(origin, siteOrigin) {
  if (origin === null) return true
  return origin === siteOrigin || PREVIEW.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)
}

/** @param {string | null} origin @returns {Record<string, string>} */
const corsHeaders = origin => ({
  vary: 'Origin',
  ...(origin ? { 'access-control-allow-origin': origin } : {}),
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400',
})

/** @param {unknown} body @param {number} status @param {string | null} origin @returns {Response} */
const json = (body, status, origin) =>
  new Response(`${JSON.stringify(body)}\n`, { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) } })

/** @param {number} status @param {string} error @param {string} message @param {string | null} origin */
const fail = (status, error, message, origin) => json({ error, message }, status, origin)

/**
 * Whether the submitted Turnstile token is good. With no secret configured there is no challenge
 * and every report passes.
 * @param {Env} env @param {string} token @param {string} ip @returns {Promise<boolean>}
 */
async function passesTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true
  if (!token) return false
  const body = new FormData()
  body.set('secret', env.TURNSTILE_SECRET)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)
  const response = await fetch(TURNSTILE_VERIFY, { method: 'POST', body })
  if (!response.ok) return false
  const verdict = /** @type {{ success?: boolean }} */ (await response.json())
  return verdict.success === true
}

/**
 * Commit the report's attachments and answer with the URLs the issue body should point at. A
 * failure here is not a failure of the report: the issue is filed without the images and says so.
 * @param {Env} env @param {Report} report @param {string} title
 * @returns {Promise<import('./issue.js').Attachments>}
 */
async function storeAttachments(env, report, title) {
  const offered = [report.image, report.documentFile].filter(Boolean)
  if (!offered.length) return { image: null, document: null, failed: false }
  const now = new Date()
  const folder = `reports/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const paths = offered.map(attachment => `${folder}/${crypto.randomUUID()}.${/** @type {NonNullable<typeof attachment>} */ (attachment).ext}`)
  try {
    await uploadAttachments(
      env,
      offered.map((attachment, index) => ({ path: paths[index], bytes: /** @type {NonNullable<typeof attachment>} */ (attachment).bytes })),
      `report: ${title}`,
    )
  } catch {
    return { image: null, document: null, failed: true }
  }
  let next = 0
  const image = report.image ? rawUrl(env, paths[next++]) : null
  const document = report.documentFile ? rawUrl(env, paths[next]) : null
  return { image, document, failed: false }
}

/**
 * The endpoint. Anything thrown below becomes a `502` rather than an empty 500, so a reporter
 * always gets an answer shaped like the rest of them.
 * @param {Request} request @param {Env} env @returns {Promise<Response>}
 */
export async function handle(request, env) {
  try {
    return await route(request, env)
  } catch (error) {
    console.error('the report endpoint threw', error)
    const origin = request.headers.get('origin')
    return fail(502, 'upstream_error', 'The report could not be handled. Try again later.', originAllowed(origin, env.SITE_ORIGIN) ? origin : null)
  }
}

/**
 * Comment on the issue an identical report became, and say whether it did.
 * @param {Env} env @param {{ number: number, url: string }} known @returns {Promise<boolean>}
 */
async function commentDuplicate(env, known) {
  try {
    await commentOnIssue(env, known.number, duplicateComment(new Date().toISOString()))
    return true
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error
    // The record has outlived its issue when the issue was deleted or moved, which the reporter
    // should not be told is a success; the filing below writes over the record. Another failure
    // costs only the comment, and the report did reach its issue.
    return ![404, 410].includes(error.status)
  }
}

/** @param {Request} request @param {Env} env @returns {Promise<Response>} */
async function route(request, env) {
  const origin = request.headers.get('origin')
  if (!originAllowed(origin, env.SITE_ORIGIN)) {
    return fail(403, 'forbidden_origin', 'Reports are only accepted from the workshop.', null)
  }
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200, origin)
  if (url.pathname === '/health') return fail(405, 'method_not_allowed', 'The health check answers GET.', origin)
  if (url.pathname !== '/') return fail(404, 'not_found', 'A report is posted to the root of this service.', origin)
  if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'A report is sent with POST.', origin)

  const tooBig = checkBodySize(request.headers)
  if (tooBig) return fail(tooBig.status, tooBig.error, tooBig.message, origin)
  const wrongType = checkMediaType(request.headers)
  if (wrongType) return fail(wrongType.status, wrongType.error, wrongType.message, origin)

  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const rate = await checkRate(env, ip || 'unknown')
  if (!rate.ok) return fail(429, 'rate_limited', 'Too many reports have come from here. Try again later.', origin)

  const metered = meterBody(request)
  /** @type {FormData} */
  let form
  try {
    form = await metered.request.formData()
  } catch {
    if (metered.overrun.exceeded) return fail(413, 'too_large', `A report may be at most ${MAX_BODY} bytes in total.`, origin)
    return fail(400, 'invalid_request', 'The report could not be read as a multipart form.', origin)
  }

  const parsed = await parseReport(form, { siteOrigin: env.SITE_ORIGIN })
  if (!parsed.ok) return fail(parsed.status, parsed.error, parsed.message, origin)
  const report = parsed.report

  if (!(await passesTurnstile(env, report.turnstile, ip))) {
    return fail(403, 'captcha_failed', 'The challenge did not pass. Reload the workshop and try again.', origin)
  }

  const key = await dedupeKey(report.sequence, report.symptom)
  const known = await findDuplicate(env, key)
  if (known && (await commentDuplicate(env, known))) {
    return json({ number: known.number, url: known.url, duplicate: true }, 200, origin)
  }

  const title = issueTitle(report)
  /** @type {{ number: number, url: string }} */
  let issue
  try {
    const attachments = await storeAttachments(env, report, title)
    const labels = labelsFor(report.context)
    await ensureLabels(env, labels)
    issue = await createIssue(env, { title, body: issueBody(report, attachments), labels })
  } catch (error) {
    console.error('filing the report failed', error)
    return fail(502, 'upstream_error', 'GitHub did not accept the report. Try again later.', origin)
  }
  // The issue exists from here on. A failed write only costs the next identical report its dedupe.
  try {
    await rememberIssue(env, key, issue)
  } catch (error) {
    console.error('remembering the report failed', error)
  }
  return json({ number: issue.number, url: issue.url, duplicate: false }, 201, origin)
}

export default {
  /** @param {Request} request @param {Env} env @returns {Promise<Response>} */
  fetch(request, env) {
    return handle(request, env)
  },
}
