// Where reports go: the deployed intake Worker, overridable for a local run. The deployed URL is
// filled in once the Worker is up.
export const REPORT_ENDPOINT = import.meta.env.VITE_REPORT_ENDPOINT || 'https://report.ids.mkpo.li/'

const LOCAL = /^(?:localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|\[::1?\]|.+\.local|.+\.localhost)$/i

/** The endpoint this page sends to: `?endpoint=` in the address first, so a local run can point
 *  somewhere else. The published site ignores it, so a shared link cannot send anyone's report to
 *  a collector of its own. @param {Location | URL} [where] @returns {string} */
export function reportEndpoint(where = location) {
  const asked = new URLSearchParams(where.search).get('endpoint')
  const run = where instanceof URL ? where : new URL(where.href)
  if (asked && (run.protocol === 'file:' || LOCAL.test(run.hostname))) {
    try { return new URL(asked, run.href).href } catch { /* An address that is not an endpoint. */ }
  }
  return REPORT_ENDPOINT
}
