// Files a report from the workshop. The endpoint dispatches each report here so that the issue is
// opened by this action: the workshop's own bot is its author, and the report names the reporter.

import { readFile } from 'node:fs/promises'

import { getOctokit } from '@actions/github'
import { fileReport } from './file.js'

const token = process.env.GITHUB_TOKEN ?? ''
const [owner, repo] = (process.env.REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? '').split('/')
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'))
const github = getOctokit(token)
await fileReport({ github, context: { repo: { owner, repo }, payload: event }, cwd: process.env.GITHUB_WORKSPACE ?? process.cwd() })
