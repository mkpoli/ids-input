// Files the reports the workshop's dialog sends. The site posts a report to the endpoint, which
// hands it here as a `repository_dispatch` so that the issue carries the workshop's own action as
// its author and the reporter as its reporter; the drawing is taken from the site itself and
// committed to `bug-attachments` with the token this run is given.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ensureLabels, createIssue } from '../src/github.js'
import { issueBody, issueTitle, labelsFor } from '../src/issue.js'
import { intake } from './pipeline.js'
import { requestOf } from './dispatch.js'

/** The site the dialog is served from, and the previews of it. */
const SITE = 'https://ids.mkpo.li'
const PREVIEW = /^https:\/\/(?:[a-z0-9-]+-)?ids-input-workshop\.mkpoli\.workers\.dev$/

/** @param {Record<string, string>} headers @param {number} status @param {string} error @param {string} message */
const fail = (headers, status, error, message) => ({
  status,
  headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
  body: `${JSON.stringify({ error, message })}\n`,
})

/** @param {string} origin */
const allow = origin => origin === SITE || PREVIEW.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)

/**
 * The folder a run's attachments wait in, before the job commits them to `bug-attachments`.
 * @param {string} root
 */
const cache = root => join(root, '.cache', 'report')

/** @param {{ github: any, context: any, cwd?: string }} options */
export async function fileReport({ github, context, cwd = process.cwd() }) {
  const payload = /** @type {any} */ (context.payload).client_payload ?? {}
  /** @type {WebhookResponse} */
  let answer
  try {
    const read = await intake(requestOf(payload), { allow })
    if (!read.ok) throw Object.assign(new Error('refused'), read)
    const { report, drawing } = read
    const repo = { owner: context.repo.owner, repo: context.repo.repo }
    // The run's token: a dispatch files as the workshop's own action, and the bot owns that action.
    const env = { REPO: `${repo.owner}/${repo.repo}`, GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '' }
    const title = issueTitle(report)
    const labels = labelsFor(report.context)
    await ensureLabels(env, labels)
    let attachment = null
    if (drawing) {
      // The bytes wait on disk for the step that commits them, and the issue names where they land.
      const path = `reports/${new Date().toISOString().slice(0, 7).replace('-', '/')}/${crypto.randomUUID()}.png`
      await mkdir(cache(cwd), { recursive: true })
      await writeFile(join(cache(cwd), 'drawing.png'), Buffer.from(drawing.data, 'base64'))
      await writeFile(join(cache(cwd), 'attachment'), `${path}\n`, 'utf8')
      attachment = `https://github.com/${env.REPO}/raw/bug-attachments/${path}`
    }
    // The issue is filed with the run's token, which on a dispatch is the workshop's own action.
    const issue = await createIssue(env, { title, labels, body: issueBody(report, { image: attachment, document: null, failed: false }) })
    answer = { status: 201, body: `${JSON.stringify({ number: issue.number, url: issue.url, duplicate: false })}\n` }
  } catch (error) {
    const refused = /** @type {any} */ (error)
    answer = refused.status ? { status: refused.status, body: refused.body } : fail({}, 502, 'upstream_error', 'The report could not be filed. Try again later.')
    console.error(error)
  }
  // The dialog has been waiting on this run since it posted; the endpoint holds the connection.
  await github.rest.repos.createDispatchEvent({
    ...context.repo, event_type: 'report_answer', client_payload: { event: 'report_answer', payload: { id: payload.id, ...answer } },
  })
}

/** The answer a report became. */
/** @typedef {{ status: number, body: string }} WebhookResponse */
