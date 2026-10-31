#!/usr/bin/env bun
// Runs the demo's browser checks against a local dev server, the way they are written to run.
//
//   bun run check:demo                     every check
//   bun run check:demo -- --only similar   the checks whose file name contains "similar"
//   bun run check:demo -- --port 5186      a port of your choosing
//   bun run check:demo -- --retries 2      more attempts for a check that fails (one by default)
//   bun run check:demo -- --skip gongche   leave the slow or focused checks out (comma separated)
//
// The checks type into the workshop and open its fixture pages, and `vite build` leaves those pages
// out of `dist/`, so a static server reports failures that are not in the app. This starts
// `vite demo`, warms it with one page load (so the first check does not pay the dev server's cold
// transform), points IDS_URL at it, and stops it again. Chromium comes from CHROMIUM_PATH, else from
// the Playwright cache under ~/.cache/ms-playwright.
//
// A check that fails is tried once more: in a long run the set occasionally loses a race with the
// dev server rather than with the app, and a second attempt tells the two apart. The exit code is
// non-zero only when a check fails every attempt.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium as launchable } from 'playwright-core'

const arg = name => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : undefined }
const only = arg('--only')
const skip = (arg('--skip') ?? '').split(',').filter(Boolean)
const port = Number(arg('--port') ?? 5186)
const retries = Number(arg('--retries') ?? 1)
const root = join(import.meta.dirname, '..')

/** The Chromium the checks launch: `CHROMIUM_PATH`, or the newest one the Playwright cache holds. */
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const cache = join(process.env.HOME ?? '', '.cache', 'ms-playwright')
  if (!existsSync(cache)) return undefined
  for (const entry of readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()) {
    for (const inside of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const path = join(cache, entry, inside)
      if (existsSync(path)) return path
    }
  }
  return undefined
}

const chromium = chromiumPath()
if (!chromium) {
  console.error('No Chromium found. Set CHROMIUM_PATH, or install one with `bunx playwright-core install chromium`.')
  process.exit(1)
}

const checks = readdirSync(join(root, 'demo'))
  .filter(name => name.startsWith('check-') && name.endsWith('.js'))
  .filter(name => !only || name.includes(only))
  .filter(name => !skip.some(text => name.includes(text)))
  .sort()
if (checks.length === 0) {
  console.error(`No check file matches ${only}.`)
  process.exit(1)
}

let url = ''
/** @type {import('node:child_process').ChildProcess | undefined} */
let server
let log = ''
const stop = () => { if (server && server.exitCode === null) server.kill('SIGTERM') }
process.on('exit', stop)
process.on('SIGINT', () => { stop(); process.exit(130) })

/** Starts the dev server and learns the address it answered on. Vite takes the next free port when
 *  the one asked for is held, so the runner reads the address from its output instead of assuming
 *  it; a restart therefore cannot collide with another session's server. */
async function start() {
  log = ''
  server = spawn('bun', ['run', 'dev', '--', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stdout.on('data', chunk => { log += chunk })
  server.stderr.on('data', chunk => { log += chunk })
  for (let i = 0; i < 180; i++) {
    if (server.exitCode !== null) break
    const found = log.match(/Local:\s+(http:\/\/localhost:\d+)/)
    if (found) { url = found[1]; return }
    await Bun.sleep(500)
  }
  console.error(log.trim() || 'The dev server did not start.')
  process.exit(1)
}

/** Whether the dev server still answers; a run of heavy pages can take it down or stall it. */
async function alive() {
  try { return (await fetch(`${url}/`, { signal: AbortSignal.timeout(5000) })).ok } catch { return false }
}

/** The end of the server's output, for a crash report. */
const tail = () => log.trim().split('\n').slice(-8).map(line => `     ${line}`).join('\n')

/** Loads the workshop once, so the checks do not pay the dev server's first transform each run. */
async function warm() {
  const browser = await launchable.launch({ executablePath: chromium })
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 })
    await page.locator('.ids-field input').waitFor({ timeout: 180000 })
  } finally { await browser.close() }
}

/** Runs one check file and reports whether it passed, with what it printed. A check that hangs is
 *  stopped after `limit` seconds, so one wedged browser cannot hold the whole run. */
function run(file, limit = 600) {
  return new Promise(resolve => {
    const child = spawn('bun', [join('demo', file)], {
      cwd: root,
      env: { ...process.env, IDS_URL: url, CHROMIUM_PATH: chromium },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const timer = setTimeout(() => { output += `\n(stopped after ${limit}s)`; child.kill('SIGKILL') }, limit * 1000)
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    child.on('error', error => { clearTimeout(timer); resolve({ code: 1, output: `${output}\n${error.message}` }) })
    child.on('close', code => { clearTimeout(timer); resolve({ code, output }) })
  })
}

await start()
await warm()
console.log(`${checks.length} checks against ${url}`)
const failed = []
for (const [index, file] of checks.entries()) {
  if (!(await alive())) {
    console.log('  the dev server has gone; restarting it')
    console.log(tail())
    stop()
    await Bun.sleep(500)
    log = ''
    await start()
    await warm()
  }
  const started = Date.now()
  let { code, output } = await run(file)
  const attempts = [1]
  while (code !== 0 && attempts.length <= retries) {
    attempts.push(attempts.length + 1)
    ;({ code, output } = await run(file))
  }
  const took = ((Date.now() - started) / 1000).toFixed(0)
  const tries = attempts.length > 1 ? ` (${attempts.length} attempts)` : ''
  if (code === 0) {
    console.log(`  ${String(index + 1).padStart(2)} ${file.padEnd(30)} ok    ${took}s${tries}`)
    continue
  }
  failed.push(file)
  console.log(`  ${String(index + 1).padStart(2)} ${file.padEnd(30)} FAIL  ${took}s${tries}`)
  console.log(output.split('\n').filter(line => line.trim()).slice(-10).map(line => `     ${line}`).join('\n'))
}
stop()
if (failed.length) {
  console.error(`${failed.length} of ${checks.length} checks failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`All ${checks.length} checks passed.`)
