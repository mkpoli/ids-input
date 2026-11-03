// The bundled fallback outlines, one webfont face per 256-code-point shard. A text-style sheet
// downloads every face whose range its text meets at once, so a panel of rare characters would pull
// megabytes on first paint. Each shard is a `FontFace` registered and loaded the first time one of
// its characters is shown, so the reader pays for the shards their screens need. The dev server
// names the files itself; `demo/vite.config.js` writes `unicode.json` with the published names.

import { download } from '../core/retry.js'

const FAMILY = 'IDS Fallback'
// The shards are registered under `IDS Fallback Shared`, and `--fallback-font` names it in the
// stacks: a family that a stylesheet also declares would match nothing in Firefox and WeChat.
const SHARED = 'IDS Fallback Shared'
// No element uses the oblique style, so the browser does not pull the faces for plain text.
const STYLE = 'oblique 0deg'
/** The shards, by the first byte of their range, read from the sheet that declares them. */
/** @type {Set<string>} */
const SHARDS = new Set()
/** @type {Record<string, string>} */
let published = {}
// While developing, the sheet names the shards; the build writes `unicode.json` with their names.
const ready = download(new URL('unicode.json', new URL('./', document.baseURI)))
  .then(response => response.ok ? response.json() : { files: {} })
  .then(data => {
    published = data.files ?? {}
    for (const name of Object.keys(published)) SHARDS.add(name)
    // The dev server has no `unicode.json`: the shards are the files it publishes.
    for (const name of Object.keys(DEV_SHARDS)) SHARDS.add(name)
  })
  .catch(() => { for (const name of Object.keys(DEV_SHARDS)) SHARDS.add(name) })

/** The dev server's addresses for the shards, the fonts directory's files as URL imports.
 * @type {Record<string, string>} */
const DEV_SHARDS = {}
/** Each published shard's range, from the stylesheet the builder wrote. @type {Map<string, string>} */
const RANGES = new Map()
for (const [, name, range] of (await import('../../fonts/unicode.css?raw')).default.matchAll(/url\("\.\/unicode\/([0-9a-f]{3})\.woff2"\)[^}]*unicode-range:([^}]*)\}/g)) RANGES.set(name, range)
// Each shard as a module URL the dev server serves; the build hashes them into its asset folder and
// names them in `unicode.json` instead.
const DEV = import.meta.glob('../../fonts/unicode/*.woff2', { query: '?url', import: 'default', eager: true })
for (const [path, url] of Object.entries(DEV)) DEV_SHARDS[/\/([0-9a-f]{3})\.woff2$/.exec(path)?.[1] ?? path] = url

/** @type {Map<string, Promise<FontFace>>} */
const faces = new Map()

/**
 * Points `--fallback-font` at `IDS Fallback Shared`, a family the document now has a face of, so the
 * stacks that ask for it draw with the shards before the installed fonts.
 */
function address() {
  const style = document.getElementById('ids-fallback-font') ?? document.createElement('style')
  style.id = 'ids-fallback-font'
  style.textContent = `:root{--fallback-font:"${SHARED}"}`
  if (!style.isConnected) document.head.append(style)
}

/**
 * Registers and loads the shard that draws `char`, once; a character in no shard stays the
 * browser's to draw, in the family before the fallback.
 * @param {string} char
 */
export function loadFallback(char) {
  const name = ((char.codePointAt(0) ?? 0) >> 8).toString(16).padStart(3, '0')
  let face = faces.get(name)
  if (!face) {
    face = ready.then(() => {
      if (!SHARDS.has(name)) throw new Error('no shard')
      // The build writes `unicode.json` beside the page with the published shard files in it; the
      // dev server publishes the shard as a URL import, which the bundler hands here as a file URL.
      // A shard draws only its own range: a face without one covers every character, and a shard
      // with no glyph for a character in its range would then hide the later faces for it.
      const url = published[name] ?? DEV_SHARDS[name]
      const made = new FontFace(SHARED, `url("${url}")`, { style: STYLE, unicodeRange: RANGES.get(name) })
      document.fonts.add(made)
      address()
      return made.load()
    }).catch(() => new FontFace(SHARED, ''))
    faces.set(name, face)
  }
  face.catch(() => {})
}

/**
 * Loads the shards of every character in `text`.
 * @param {string | null | undefined} text
 */
export function loadFallbackText(text) {
  for (const char of text ?? '') loadFallback(char)
}

/** Debounce a panel's rescan as it re-renders. */
const PENDING = new WeakMap()

/**
 * Loads the shards of every character under `root` that scrolls into view, and again as the panel
 * re-renders.
 * @param {Element | null | undefined} root
 * @returns {() => void}
 */
export function watchFallback(root) {
  if (!root || typeof IntersectionObserver !== 'function') return () => {}
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer.unobserve(entry.target)
      loadFallbackText(entry.target.textContent)
    }
  }, { rootMargin: '300px' })
  /** @type {WeakSet<Element>} */
  const watched = new WeakSet()
  const scan = () => {
    for (const element of root.querySelectorAll('*')) {
      if (element.childElementCount || watched.has(element)) continue
      watched.add(element)
      observer.observe(element)
    }
  }
  const mutation = new MutationObserver(() => {
    if (PENDING.has(root)) return
    PENDING.set(root, setTimeout(() => { PENDING.delete(root); if (root.isConnected) scan() }, 50))
  })
  scan()
  mutation.observe(root, { childList: true, subtree: true, characterData: true })
  return () => {
    observer.disconnect()
    mutation.disconnect()
    const pending = PENDING.get(root)
    if (pending) { clearTimeout(pending); PENDING.delete(root) }
  }
}
