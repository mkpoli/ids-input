// @ts-check
// The intake endpoint. `POST /` takes a report as multipart form data and answers with the GitHub
// issue it became; `GET /health` answers that the Worker is up. Reporters have no account anywhere,
// so the only thing standing between the endpoint and abuse is the origin check, the rate limits
// and the optional Turnstile challenge.
//
// The issue is filed by the workshop's own GitHub Action rather than by a personal token, so it is
// the action that opens it and the report names the reporter; the Worker dispatches the report to
// that Action and waits on the answer it dispatches back.
import { duplicateComment, labelsFor } from './issue.js'
import { GitHubError, commentOnIssue, dispatch, ensureLabels } from './github.js'
import { MAX_BODY, checkBodySize, checkMediaType, meterBody, parseReport } from './validate.js'
import { checkRate, dedupeKey, findDuplicate, rememberIssue } from './limit.js'

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** @typedef {import('./validate.js').Report} Report */
/**
 * @typedef {object} Env
 * @property {KVNamespace} REPORTS
 * @property {string} REPO
 * @property {string} SITE_ORIGIN
 * @property {string} GITHUB_TOKEN the token the dispatch and the dedupe use
 * @property {string} [TURNSTILE_SECRET]
 */

/** How long a dialog waits on the Action filing its report before it is told to try again. */
const ANSWER_WAIT = Number(/** @type {any} */ (globalThis).ANSWER_WAIT ?? 200_000)
/** GitHub takes a dispatch payload under 64 KB; a report that carries more than half of that is
 *  turned away with a `413` rather than sent to fail at GitHub. */
const MAX_DISPATCH = 30_000

/** A report too large for the dispatch, which is a `413` for the reporter rather than a `502`. */
class DispatchTooLarge extends Error {}

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

/** The answers the Action dispatched, kept until the dialog that waits for one takes it. */
/** @param {string} id */
const answerKey = id => `answer:${id}`

/**
 * Ask the workshop's Action to file the report, and hand back the issue it answered with. The
 * dialog waits on this call, so the wait is bounded: past `ANSWER_WAIT` the reporter is told to
 * try again, and the answer is left where a retry of the same report can find it.
 * @param {Env} env @param {{ headers: Headers, form: FormData }} posted @param {Report} report
 * @returns {Promise<{ number: number, url: string }>}
 */
async function fileByAction(env, posted, report) {
  const id = crypto.randomUUID()
  // What the action reads: the fields the issue is written from, and the origin the dialog was
  // served from. The drawing it takes for itself from the site, so no upload rides along.
  /** @type {Record<string, string>} */
  const carried = {}
  for (const [name, value] of posted.form) if (typeof value === 'string') carried[name] = value
  const origin = posted.headers.get('origin') ?? ''
  if (Buffer.byteLength(JSON.stringify({ ...carried, origin }), 'utf8') > MAX_DISPATCH) {
    throw new DispatchTooLarge()
  }
  await dispatch(env, { event_type: 'report', client_payload: { id, origin, report: carried } })
  const answer = await waitForAnswer(env, id, ANSWER_WAIT)
  if (!answer) throw new Error('the Action did not answer in time')
  const body = JSON.parse(answer)
  if (typeof body?.number !== 'number') {
    throw Object.assign(new Error(`the Action answered ${body?.error ?? 'without an issue'}`), { answered: true, message: body?.message })
  }
  return { number: body.number, url: String(body.url ?? '') }
}

/**
 * The answer the Action left for this report, or null once `ms` has gone by.
 * @param {Env} env @param {string} id @param {number} ms @returns {Promise<string | null>}
 */
async function waitForAnswer(env, id, ms) {
  const until = Date.now() + ms
  for (;;) {
    const kept = await env.REPORTS.get(answerKey(id))
    if (kept !== null) {
      await env.REPORTS.delete(answerKey(id))
      return kept
    }
    if (Date.now() >= until) return null
    await new Promise(done => setTimeout(done, 2_000))
  }
}

/**
 * The answer an Action dispatched, put where the waiting dialog will find it.
 * @param {Env} env @param {{ id?: unknown, status?: unknown, body?: unknown }} event
 * @returns {Promise<void>}
 */
export async function keepAnswer(env, event) {
  const id = typeof event.id === 'string' ? event.id : ''
  const body = typeof event.body === 'string' ? event.body : ''
  if (!id || !body) return
  await env.REPORTS.put(answerKey(id), body, { expirationTtl: 600 })
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

  /** @type {{ number: number, url: string }} */
  let issue
  try {
    await ensureLabels(env, labelsFor(report.context))
    issue = await fileByAction(env, { headers: request.headers, form }, report)
  } catch (error) {
    if (error instanceof DispatchTooLarge) return fail(413, 'too_large', 'This report is too large to send. Leave the document out and try again.', origin)
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
  // GitHub hands the Action's answer to the queue this Worker consumes, as a repository dispatch.
  /** @param {{ messages: { body?: { event?: string, payload?: Record<string, unknown> } }[] }} batch @param {Env} env */
  async queue(batch, env) {
    for (const message of batch.messages) {
      if (message.body?.event === 'report_answer') await keepAnswer(env, message.body.payload ?? {})
    }
  },
}
