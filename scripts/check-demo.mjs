#!/usr/bin/env bun
// Runs the demo's browser checks against a local dev server, the way they are written to run.
//
//   bun run check:demo                     every check
//   bun run check:demo -- --only similar   the checks whose file name contains "similar"
//   bun run check:demo -- --port 5186      a port of your choosing
//   bun run check:demo -- --retries 2      more attempts for a check that fails (one by default)
//   bun run check:demo -- --jobs 1         run the checks one after another (two at a time by default)
//   bun run check:demo -- --skip gongche   leave the slow or focused checks out (comma separated)
//   bun run check:demo -- --limit 600      stop a check after ten minutes (fifteen by default)
//   bun run check:demo -- --watchdog 5     stop when nothing finishes for five minutes (by default a
//                                          minute past every attempt at one check)
//   bun run check:demo -- --timeout 30     the page timeout each check gets in seconds (120 by default;
//                                          0 keeps whatever the check file asks for)
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
import { stripVTControlCharacters } from 'node:util'
import { chromium as launchable } from 'playwright-core'

const arg = name => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : undefined }
const only = arg('--only')
const skip = (arg('--skip') ?? '').split(',').filter(Boolean)
const timeout = Number(arg('--timeout') ?? 120)
const port = Number(arg('--port') ?? 5186)
const retries = Number(arg('--retries') ?? 1)
/** How many checks run at once; each owns a browser, and the dev server serves them all. */
const jobs = Math.max(1, Number(arg('--jobs') ?? 2))
/** One attempt at one check; a wedged check is stopped at this many seconds. The longest check
 *  draws every Gongche tile in both schemes and takes about eight minutes with two running at once,
 *  so the bound leaves room for a machine that is busy with something else. */
const CHECK_LIMIT = Number(arg('--limit') ?? 900)
// A check may be tried `retries + 1` times, so the run's own guard has to outlast that.
const watchdogMinutes = Number(arg('--watchdog') ?? Math.ceil((CHECK_LIMIT * (retries + 1) + 120) / 60))
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
// `bun run dev` starts vite as its own child, so the whole process group goes, not just the wrapper.
const stop = () => { if (server?.pid) { try { process.kill(-server.pid, 'SIGKILL') } catch { /* already gone */ } } }
process.on('exit', stop)
process.on('SIGINT', () => { stop(); process.exit(130) })
// A killed runner must not leave its dev server behind on the port.
process.on('SIGTERM', () => { stop(); process.exit(143) })

/** Starts the dev server and learns the address it answered on. Vite takes the next free port when
 *  the one asked for is held, so the runner reads the address from its output instead of assuming
 *  it; a restart therefore cannot collide with another session's server. */
async function start() {
  log = ''
  server = spawn('bun', ['run', 'dev', '--', '--port', String(port)], { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stdout.on('data', chunk => { log += chunk })
  server.stderr.on('data', chunk => { log += chunk })
  for (let i = 0; i < 180; i++) {
    if (server.exitCode !== null) break
    // Vite colours its output when the environment asks for it, as CI does, and the escape codes
    // sit inside the address line; read the line without them.
    const found = stripVTControlCharacters(log).match(/Local:\s+(http:\/\/localhost:\d+)/)
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
  let browser
  try {
    browser = await launchable.launch({ executablePath: chromium })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 })
    await page.locator('.ids-field input').waitFor({ timeout: 180000 })
  } catch (error) {
    // A browser that cannot start or a page that never loads would otherwise end the run silently.
    console.error(`The workshop did not load at ${url}: ${error?.message ?? error}`)
    console.error(tail())
    process.exit(1)
  } finally { await browser?.close() }
}

/** Runs one check file and reports whether it passed, with what it printed. A check that hangs is
 *  stopped after `limit` seconds, so one wedged browser cannot hold the whole run. */
function run(file, limit = CHECK_LIMIT) {
  return new Promise(resolve => {
    const preload = join(root, 'scripts', 'check-demo-preload.mjs')
    // Its own process group, so a check that hangs takes its browser down with it: killing the
    // wrapper alone leaves the browser holding the pipes, and the run waits on them forever.
    const child = spawn('bun', ['--preload', preload, join('demo', file)], {
      cwd: root,
      env: { ...process.env, IDS_URL: url, CHROMIUM_PATH: chromium, CHECK_TIMEOUT: String(timeout * 1000) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    let output = ''
    let settled = false
    /** Reports the result once; a killed check and its late `close` cannot report twice. */
    const finish = (code, note = '') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, output: `${output}${note}` })
    }
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
      // Report the stop itself rather than waiting for `close`: a browser that outlived the kill
      // still holds the pipes, and `close` may never come.
      finish(1, `\n(stopped after ${limit}s)`)
    }, limit * 1000)
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    child.on('error', error => finish(1, `\n${error.message}`))
    child.on('close', code => finish(code ?? 1))
    // A check can exit cleanly while a browser it left behind keeps the pipes open, and then `close`
    // never comes; the exit code is the verdict, after a moment for the last output.
    child.on('exit', code => setTimeout(() => finish(code ?? 1), 150))
  })
}

// A safety net: every await below has its own bound, but a dev server or a browser can still wedge
// something in a way that never settles, and a run that hangs is worse than one that fails. The
// per-check limit stays well under it, so a wedged check is reported as a failure with its output
// rather than stopping the run without a word.
let lastProgress = Date.now()
const progress = () => { lastProgress = Date.now() }
setInterval(() => {
  if (Date.now() - lastProgress < watchdogMinutes * 60 * 1000) return
  console.error(`No check finished in ${watchdogMinutes} minutes; stopping the run.`)
  stop()
  process.exit(1)
}, 30_000)

await start()
await warm()
progress()
console.log(`${checks.length} checks against ${url}, ${jobs} at a time`)
const failed = []
// One restart at a time, however many checks found the server gone.
let restarting = null
const ensureServer = async () => {
  if (await alive()) return
  restarting = restarting ?? (async () => {
    console.log('  the dev server has gone; restarting it')
    console.log(tail())
    stop()
    await Bun.sleep(500)
    log = ''
    await start()
    await warm()
  })().finally(() => { restarting = null; progress() })
  await restarting
}
/** Runs one check, with its retries, and prints its verdict. @param {number} index @param {string} file */
const check = async (index, file) => {
  await ensureServer()
  progress()
  const started = Date.now()
  let { code, output } = await run(file)
  const attempts = [1]
  while (code !== 0 && attempts.length <= retries) {
    attempts.push(attempts.length + 1)
    ;({ code, output } = await run(file))
  }
  progress()
  const took = ((Date.now() - started) / 1000).toFixed(0)
  const tries = attempts.length > 1 ? ` (${attempts.length} attempts)` : ''
  const line = `  ${String(index + 1).padStart(2)} ${file.padEnd(30)}`
  if (code === 0) { console.log(`${line} ok    ${took}s${tries}`); return }
  failed.push(file)
  console.log(`${line} FAIL  ${took}s${tries}`)
  console.log(output.split('\n').filter(entry => entry.trim()).slice(-10).map(entry => `     ${entry}`).join('\n'))
}
let next = 0
await Promise.all(Array.from({ length: Math.min(jobs, checks.length) }, async () => {
  while (next < checks.length) {
    const index = next++
    await check(index, checks[index])
  }
}))
stop()
if (failed.length) {
  console.error(`${failed.length} of ${checks.length} checks failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`All ${checks.length} checks passed.`)
// The dev server's pipes keep the event loop alive; the run is over either way.
process.exit(0)
