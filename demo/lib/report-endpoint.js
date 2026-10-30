// Where reports go: `/api/report` on the site's own origin, which the hosting worker hands to the
// intake Worker, so a report stays on one origin. A local run points elsewhere with `?endpoint=`;
// the published site ignores it, so a shared link cannot send anyone's report to a collector of
// its own.
import { isLocalHost } from './report.js'

export const REPORT_PATH = '/api/report'

/** The endpoint this page sends to. @param {Location | URL} [where] @returns {string} */
export function reportEndpoint(where = location) {
  const run = where instanceof URL ? where : new URL(where.href)
  const asked = new URLSearchParams(run.search).get('endpoint')
  if (asked && (run.protocol === 'file:' || isLocalHost(run.hostname))) {
    try { return new URL(asked, run.href).href } catch { /* An address that is not an endpoint. */ }
  }
  return new URL(REPORT_PATH, run.href).href
}
