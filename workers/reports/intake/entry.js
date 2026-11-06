// The intake Worker's two entry points, run outside Cloudflare: `fetch` for a request, and `queue`
// for the answer the Action in `.github/workflows/file-report.yml` dispatches back.

import worker from '../src/index.js'

/** @param {unknown} request @param {unknown} env @returns {Promise<Response>} */
export const fetch = (request, env) => worker.fetch(/** @type {Request} */ (request), /** @type {any} */ (env))

/**
 * @param {unknown} body the message the queue carries
 * @param {unknown} env @returns {Promise<void>}
 */
export const queue = async (body, env) => worker.queue({ messages: [{ body }] }, /** @type {any} */ (env))
