// What a problem report carries and how it is sent: a console ring installed before the app runs, a
// snapshot of the workspace read once at submit, the drawing as a PNG, and the multipart request to
// the intake Worker. A page served from a machine of its own says so instead of naming its host, so
// no local address or file path reaches the issue.
import { EMPTY_MARKS } from '../../src/core/ids.js'
import { DEFAULTS, pngOf, pngOfSvg, scopedPngOf } from './exporting.js'

/** @typedef {{ at: number, level: 'error' | 'warn', text: string }} LogEntry */
/** What the output panel has drawn: the composed drawing, or the scoped document the export uses.
 *  @typedef {{ drawing: import('../../src/adapter/types.js').Drawing | null,
 *   scopes?: import('../../src/document/index.js').ScopeTree | null, slots?: number[][] }} Drawn */
/** @typedef {{ sequence: string, link: string, document: string, context: string, image: Blob | null }} ReportSnapshot */
/** @typedef {{ number: number, url: string, duplicate: boolean }} ReportAnswer */

/** The sizes the intake accepts; the request is held to them here too. */
export const LIMITS = { symptom: 4000, sequence: 2000, contact: 200, link: 4000, document: 200 * 1024, context: 32 * 1024, image: 5 * 1024 * 1024 }
const RING = 20, LINE = 500, BURST = 100, ATTRIBUTE = 120
const SITE = 'https://ids.mkpo.li'
const HOST = String.raw`localhost|127(?:\.\d{1,3}){1,3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[[0-9a-f:]*:[0-9a-f:]*\]|[\w.-]*\.local(?:host)?`
const LOCAL = new RegExp(`^(?:${HOST})$`, 'i')

/** Whether a host is this machine's: loopback, a private range, or a `.local`/`.localhost` name. The
 *  endpoint module uses the same test for where `?endpoint=` may point. @param {string} host */
export const isLocalHost = host => LOCAL.test(host)
// Anything naming this machine, wherever it turns up in a line of text, and the query of any other
// address: a match runs to the next space, so a port, a query and a `/@fs/` path all go with it.
// Free text cannot be filtered exactly; this takes out the shapes a page's own messages carry.
const PRIVATE = [
  [new RegExp(String.raw`\b(?:https?|wss?)://(?:${HOST})(?::\d+)?[^\s"']*`, 'gi'), '(local)'],
  [/\bfile:\/{1,3}[^\s"']*/gi, '(local)'],
  [/\/@fs\/[^\s"']*/gi, '(local)'],
  [/\b[A-Za-z]:\\[^\s"'`)\]]+/g, '(local)'],
  [/\/(?:home|Users|tmp|private|var\/folders)\/[^\s"'`)\]]+/gi, '(local)'],
  // What is left is a remote address; its path says where, its query may say who.
  [/(\b(?:https?|wss?):\/\/[^\s"'`)\]]*?)[?#][^\s"'`)\]]*/gi, '$1'],
]

/** Text with anything naming this machine, and any address's query, taken out, so nothing of the
 *  reporter's own reaches the issue. @param {string} text */
export function redact(text) {
  let clean = text
  for (const [pattern, instead] of PRIVATE) clean = clean.replace(/** @type {RegExp} */ (pattern), /** @type {string} */ (instead))
  return clean
}
/** The drawing as the report attaches it. */
const SHOT = { ...DEFAULTS, size: 1024, background: /** @type {const} */ ('white'), placeholders: true }

/** @type {LogEntry[]} */
const ring = []
let installed = false, recording = false, sending = false

/** A value as one line of text. @param {unknown} value */
function say(value) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  try { return JSON.stringify(value) ?? String(value) } catch { return String(value) }
}

/** An address fit for a public issue: a local origin becomes the published site, a file becomes a
 *  note. @param {string} value */
function publicHref(value) {
  try {
    const url = new URL(value, globalThis.location?.href)
    if (url.protocol === 'file:') return '(local file)'
    if (isLocalHost(url.hostname)) {
      const site = new URL(SITE)
      url.protocol = site.protocol
      url.hostname = site.hostname
      url.port = site.port
    }
    return url.href
  } catch { return '' }
}

/** The share link within the size a report can carry: the document part is dropped rather than cut,
 *  so a link that arrives still reopens the sequence. @param {string} value @returns {string} */
export function shareLink(value) {
  const whole = shareHref(value)
  if (whole.length <= LIMITS.link) return whole
  const url = new URL(whole)
  url.searchParams.delete('doc')
  const short = url.href
  return short.length <= LIMITS.link ? short : short.slice(0, LIMITS.link)
}

/** A link on the published site, carrying only the sequence and the document. @param {string} value */
function shareHref(value) {
  try {
    const url = new URL(value, globalThis.location?.href)
    if (url.protocol === 'file:') return ''
    for (const name of [...url.searchParams.keys()]) if (name !== 'ids' && name !== 'doc') url.searchParams.delete(name)
    url.hash = ''
    const site = new URL(SITE)
    url.protocol = site.protocol
    url.hostname = site.hostname
    url.port = site.port
    return url.href
  } catch { return '' }
}

/** An address in a log line or in the context: no query, since only the share link carries one, and
 *  nothing of this machine. @param {string} value */
function logHref(value) {
  const href = publicHref(value)
  try {
    const url = new URL(href)
    url.search = ''
    return redact(url.href)
  } catch { return redact(href) }
}

/** @param {LogEntry['level']} level @param {string} text */
function record(level, text) {
  if (recording) return
  recording = true
  try {
    ring.push({ at: Number((performance.now() / 1000).toFixed(3)), level, text: redact(text).slice(0, LINE) })
    if (ring.length > RING) ring.shift()
  } finally { recording = false }
}

/** The entries kept, oldest first. @returns {LogEntry[]} */
export const consoleRing = () => ring.slice()

/**
 * Keep the last warnings, errors, uncaught faults and failed requests, so a report carries what the
 * page already said. Installed from main.js before the app mounts: an accessor keeps the ring even
 * where the page's own code replaces `console.error`, and nothing recorded here logs or fetches, so
 * a failing report cannot feed itself.
 */
export function watchConsole() {
  if (installed) return
  installed = true
  for (const level of /** @type {const} */ (['error', 'warn'])) {
    const original = console[level].bind(console)
    let target = original, inside = false, spent = 0, counting = false
    const wrapper = /** @type {typeof console.error} */ ((...args) => {
      // A page that wraps this wrapper and calls it back gets the console the browser gave, whether
      // it calls back at once or in a later task, so the two cannot call each other forever.
      if (inside || spent > BURST) { original(...args); return }
      if (!counting) { counting = true; setTimeout(() => { spent = 0; counting = false }) }
      spent++
      inside = true
      try {
        record(level, args.map(say).join(' '))
        target(...args)
      } finally { inside = false }
    })
    try {
      Object.defineProperty(console, level, { configurable: true, get: () => wrapper, set: next => { target = next } })
    } catch { /* A console that will not be wrapped leaves the ring to the handlers below. */ }
  }
  addEventListener('error', event => {
    const where = event.filename ? ` (${logHref(event.filename)}:${event.lineno})` : ''
    record('error', `${event.message || say(event.error) || 'error'}${where}`)
  }, true)
  addEventListener('unhandledrejection', event => record('error', `unhandled rejection: ${say(event.reason)}`), true)
  const fetched = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : String(input)
    try {
      const response = await fetched(input, init)
      // The report's own request is left out: a failed send belongs to the dialog, not the ring.
      if (!response.ok && !sending) record('warn', `fetch ${response.status} ${logHref(url)}`)
      return response
    } catch (error) {
      if (!sending) record('error', `fetch failed ${logHref(url)}: ${say(error)}`)
      throw error
    }
  }
}

/** The families `document.fonts` has loaded, each once. */
function loadedFonts() {
  /** @type {Set<string>} */
  const families = new Set()
  try {
    for (const font of document.fonts) if (font.status === 'loaded') families.add(font.family.replace(/^["']|["']$/g, ''))
  } catch { /* A browser without the font set says nothing. */ }
  return [...families].sort()
}

/** One of the preview's own attributes, short and with nothing of this machine in it.
 *  @param {Element | null} preview @param {string} name */
const attribute = (preview, name) => redact(preview?.getAttribute(name) ?? '').slice(0, ATTRIBUTE)

/** What the page is and where it stands, without its query.
 *  @param {{ locale: string, theme: string, face: string, composer: string }} settings
 *  @param {Element | null} preview @returns {Record<string, unknown>} */
export function reportContext(settings, preview) {
  return {
    appVersion: __APP_VERSION__,
    commit: String(__BUILD_COMMIT__).slice(0, 8),
    route: location.protocol === 'file:' ? '(local file)' : redact(`${location.pathname}${location.hash}`).slice(0, 1000),
    preview: [attribute(preview, 'data-step'), attribute(preview, 'data-label')].filter(Boolean).join(' / '),
    viewport: `${innerWidth}×${innerHeight}`,
    devicePixelRatio,
    locale: settings.locale,
    theme: settings.theme,
    face: settings.face,
    composerBase: logHref(settings.composer).slice(0, 300),
    userAgent: navigator.userAgent.slice(0, 500),
    platform: navigator.platform,
    fonts: loadedFonts(),
    local: location.protocol === 'file:' || isLocalHost(location.hostname) || undefined,
    // A pull request's preview is not the published page, and a report from one should say so.
    previewVersion: location.hostname.endsWith('.workers.dev') || undefined,
    historyLength: history.length,
  }
}

/** The workspace as JSON within the intake's size: a report from a busy set of tabs loses its last
 *  tabs rather than its whole document. @param {unknown} workspace @returns {string} */
export function workspaceJson(workspace) {
  const whole = /** @type {{ tabs?: unknown[] }} */ (workspace ?? {})
  const tabs = Array.isArray(whole.tabs) ? [...whole.tabs] : []
  let text = JSON.stringify(whole)
  while (tabs.length > 1 && byteLength(text) > LIMITS.document) {
    tabs.pop()
    text = JSON.stringify({ ...whole, tabs, droppedTabs: (whole.droppedTabs ?? 0) + 1 })
  }
  return text
}

/** The size of a string in UTF-8 bytes, which is what the intake measures. @param {string} text */
const byteLength = text => new TextEncoder().encode(text).length

/** The context as JSON within its size: the oldest log entries go first, then the font list.
 *  @param {Record<string, unknown>} context @param {LogEntry[]} entries */
function contextJson(context, entries) {
  let kept = entries
  for (;;) {
    const text = JSON.stringify({ ...context, console: kept })
    if (byteLength(text) <= LIMITS.context) return text
    if (kept.length) { kept = kept.slice(1); continue }
    const trimmed = JSON.stringify({ ...context, fonts: [], userAgent: String(context.userAgent).slice(0, 200), console: [] })
    if (byteLength(trimmed) <= LIMITS.context) return trimmed
    const { appVersion, commit, route, viewport, locale, theme, face, local } = context
    return JSON.stringify({ appVersion, commit, route: String(route).slice(0, 200), viewport, locale, theme, face, local, console: [] })
  }
}

/** The colours the preview's scoped rules give an empty slot and a stroke; standalone, the clone
 *  would fall back to black fills and no strokes. */
const SLOT_STYLE = '<style>.slot-fill{fill:#f1f1f1}.slot-line{fill:none;stroke:#b9b9b9;stroke-linecap:round}.ink{fill:#000}</style>'

/** An SVG element as a standalone document at `size` pixels square. @param {SVGElement} svg @param {number} size */
function standalone(svg, size) {
  const clone = /** @type {SVGElement} */ (svg.cloneNode(true))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  clone.insertAdjacentHTML('afterbegin', SLOT_STYLE)
  return new XMLSerializer().serializeToString(clone)
}

/** Wait while the preview still says it is drawing, or `ms` passes: a report sent from a deep link
 *  arrives before the first composition, and a picture of placeholders says less than one of the
 *  drawing. @param {Element | null} preview @param {number} [ms] */
async function settled(preview, ms = 6000) {
  const busy = () => ['loading', 'idle'].includes(preview?.getAttribute('data-step') ?? '')
  if (!preview || !busy()) return
  await new Promise(resolve => {
    const stop = () => { observer.disconnect(); clearTimeout(timer); resolve() }
    const observer = new MutationObserver(() => { if (!busy()) stop() })
    observer.observe(preview, { attributes: true, attributeFilter: ['data-step'] })
    const timer = setTimeout(stop, ms)
  })
}

/** The drawing as a PNG — the scoped document's where it has one, as the export does — else the
 *  preview's own SVG rasterized the same way; null when neither works, so a report still goes
 *  without one. @param {Drawn} drawn @param {Element | null} preview @returns {Promise<Blob | null>} */
export async function reportImage({ drawing, scopes, slots = [] }, preview) {
  if (scopes ?? drawing) {
    try {
      const png = scopes ? await scopedPngOf(scopes, SHOT, slots) : await pngOf(/** @type {NonNullable<typeof drawing>} */ (drawing), SHOT)
      if (png.size <= LIMITS.image) return png
    } catch { /* The preview's SVG below. */ }
  }
  const svg = preview?.querySelector('svg')
  if (svg) {
    try {
      const png = await pngOfSvg(standalone(/** @type {SVGElement} */ (svg), SHOT.size), SHOT.size, '#ffffff')
      if (png.size <= LIMITS.image) return png
    } catch { /* No image. */ }
  }
  return null
}

/**
 * Everything a report carries, read once at submit so nothing re-renders while it is sent.
 * @param {Drawn & { sequence: string, link: string, workspace: unknown, preview: Element | null,
 *   locale: string, theme: string, face: string, composer: string }} source
 * @returns {Promise<ReportSnapshot>}
 */
export async function reportSnapshot(source) {
  // An empty tab writes a mark of its own (or `＋`); the intake reads an empty sequence as no
  // sequence, and nothing is drawing, so there is nothing to wait for.
  const sequence = EMPTY_MARKS.includes(source.sequence) ? '' : source.sequence.slice(0, LIMITS.sequence)
  if (sequence) await settled(source.preview)
  const taken = {
    sequence,
    link: shareLink(source.link),
    document: workspaceJson(source.workspace),
    context: contextJson(reportContext(source, source.preview), consoleRing()),
  }
  // The context keeps what was on screen; the picture may wait for the first drawing.
  return { ...taken, image: await reportImage(source, source.preview) }
}

/** What the intake said went wrong. */
export class ReportError extends Error {}

/**
 * Send a report and give back the issue it became.
 * @param {string} endpoint @param {{ symptom: string, contact: string, image: boolean, snapshot: ReportSnapshot }} report
 * @returns {Promise<ReportAnswer>}
 */
export async function sendReport(endpoint, { symptom, contact, image, snapshot }) {
  const body = new FormData()
  // A long account is cut, never refused.
  body.set('symptom', symptom.slice(0, LIMITS.symptom))
  if (snapshot.sequence) body.set('sequence', snapshot.sequence)
  if (snapshot.link) body.set('link', snapshot.link)
  // A workspace past the field's size rides as the file field instead.
  if (byteLength(snapshot.document) <= LIMITS.document) body.set('document', snapshot.document)
  else body.set('documentFile', new File([snapshot.document], 'workspace.ids.json', { type: 'application/json' }))
  body.set('context', snapshot.context)
  const reach = contact.trim().slice(0, LIMITS.contact)
  if (reach) body.set('contact', reach)
  if (image && snapshot.image) body.set('image', new File([snapshot.image], 'drawing.png', { type: 'image/png' }))
  sending = true
  try {
    const response = await fetch(endpoint, { method: 'POST', body })
    const answer = await response.json().catch(() => null)
    if (!response.ok || typeof answer?.number !== 'number') {
      throw new ReportError(String(answer?.message || answer?.error || `HTTP ${response.status}`))
    }
    return { number: answer.number, url: String(answer.url ?? ''), duplicate: answer.duplicate === true }
  } finally { sending = false }
}
