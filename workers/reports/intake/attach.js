// Commits the drawing a run left in `.cache/report` to `bug-attachments`, with the run's own token.
// The report's body points at this address, so the file has to arrive there.

import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const cwd = process.env.GITHUB_WORKSPACE ?? process.cwd()
const folder = join(cwd, '.cache', 'report')
const path = (await readFile(join(folder, 'attachment'), 'utf8')).trim()
if (!path) throw new Error('the report has no attachment to commit')
const drawing = join(folder, 'drawing.png')
const bytes = await readFile(drawing)
console.log(`committing ${bytes.length} bytes to bug-attachments as ${path}`)

/** @param {string[]} args */
const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()

// The orphan branch alone: the report step needs nothing from it, and the branch holds only
// attachments.
git('checkout', '-q', '-B', 'bug-attachments')
await mkdir(dirname(join(cwd, path)), { recursive: true })
await copyFile(drawing, join(cwd, path))
git('add', '--force', path)
git('commit', '-q', '-m', `report: ${path}`)
git('push', '-q', 'origin', 'HEAD:bug-attachments')
