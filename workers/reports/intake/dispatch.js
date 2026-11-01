// The opening of a report as the intake reads it: the request headers the cross-origin post had,
// and the body as the base64 a `repository_dispatch` may carry. Node-only, so it loads no browser.

/** The header a dispatch carries the request headers under. */
export const HEADERS = 'x-report-headers'

/**
 * The request headers a dispatched report was posted with, as JSON.
 * @param {Record<string, unknown>} headers
 */
export const encodeHeaders = headers => Buffer.from(JSON.stringify(headers), 'utf8').toString('base64')

/**
 * The request a `repository_dispatch` payload stands for: the cross-origin post as the dialog made
 * it. `x-report-headers` holds the encoded headers, every other header is the dispatch's own.
 * @param {Record<string, unknown>} payload the `client_payload`
 * @returns {Request}
 */
export function requestOf(payload) {
  const form = typeof payload?.report === 'string' ? Buffer.from(payload.report, 'base64') : null
  if (!form) throw new Error('The dispatch carried no report.')
  const headers = typeof payload?.[HEADERS] === 'string' ? JSON.parse(Buffer.from(payload[HEADERS], 'base64').toString('utf8')) : {}
  return new Request('https://report.invalid/', { method: 'POST', headers: /** @type {Record<string, string>} */ (headers), body: form })
}
