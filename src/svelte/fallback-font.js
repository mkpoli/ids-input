// The bundled fallback outlines, one webfont face per 256-code-point shard. A text-style sheet
// downloads every face whose range its text meets at once, so a panel of rare characters would pull
// megabytes on first paint. Each shard is a `FontFace` registered and loaded the first time one of
// its characters is shown, so the reader pays for the shards their screens need. The dev server
// names the files itself; `demo/vite.config.js` writes `unicode.json` with the published names.

import { download } from '../core/retry.js'

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
    face = ready.then(async () => {
      if (!SHARDS.has(name)) throw new Error('no shard')
      // The build writes `unicode.json` beside the page with the published shard files in it; the
      // dev server publishes the shard as a URL import, which the bundler hands here as a file URL.
      // A shard draws only its own range: a face without one covers every character, and a shard
      // with no glyph for a character in its range would then hide the later faces for it.
      const url = published[name] ?? DEV_SHARDS[name]
      const attempt = () => {
        const made = new FontFace(SHARED, `url("${url}")`, { style: STYLE, unicodeRange: RANGES.get(name) })
        document.fonts.add(made)
        return made.load()
      }
      try {
        const made = await attempt()
        address()
        return made
      } catch {
        // A shard that failed to arrive is asked for once more before its characters show the box,
        // and the cache forgets it so the next appearance tries again.
        await new Promise(resolve => setTimeout(resolve, 400))
        const made = await attempt()
        address()
        return made
      }
    }).catch(() => { faces.delete(name); return new FontFace(SHARED, '') })
    faces.set(name, face)
  }
  face.catch(() => {})
}

/**
 * Loads the shards of every character in `text`. With a `stack`, only the characters that stack
 * cannot draw: a page whose fonts cover the text pays for no shard at all.
 * @param {string | null | undefined} text
 * @param {string} [stack]
 */
export function loadFallbackText(text, stack) {
  for (const char of stack ? uncovered(text ?? '', stack) : text ?? '') loadFallback(char)
}

/** What the reader's own fonts drew, per stack and character, so a panel re-rendering asks once. */
const COVERED = new Map()
/** The missing-glyph box of a stack, and the ink it draws. @type {Map<string, { data: Uint8ClampedArray, ink: number }>} */
const BOX = new Map()
// A face that arrives changes what the blocks above draw: ask again, and let the next scan decide.
document.fonts?.addEventListener?.('loadingdone', () => { COVERED.clear(); BOX.clear() })
const MEASURE = document.createElement('canvas')
MEASURE.width = 64
MEASURE.height = 64
const CONTEXT = /** @type {CanvasRenderingContext2D} */ (MEASURE.getContext('2d'))

/** `text` drawn with `stack`, as its alpha channel. @param {string} text @param {string} stack */
function render(text, stack) {
  CONTEXT.clearRect(0, 0, 64, 64)
  CONTEXT.font = `32px ${stack}`
  CONTEXT.fillText(text, 4, 48)
  return CONTEXT.getImageData(0, 0, 64, 64).data
}

/**
 * Whether the reader's fonts draw `char` in `stack`: a character they lack comes out as the same
 * missing-glyph box an unassigned code point draws.
 * @param {string} char
 * @param {string} stack
 */
function covered(char, stack) {
  let box = BOX.get(stack)
  if (!box) {
    const reference = render('\u{10FFFF}', stack)
    let ink = 0
    for (let i = 3; i < reference.length; i += 4) if (reference[i] > 100) ink++
    box = { data: reference, ink }
    BOX.set(stack, box)
  }
  const glyph = render(char, stack)
  let ink = 0
  let changed = 0
  for (let i = 3; i < glyph.length; i += 4) {
    if (glyph[i] > 100) ink++
    if (Math.abs(glyph[i] - box.data[i]) > 40) changed++
  }
  if (!ink) return false
  return changed / Math.max(box.ink, ink, 1) >= 0.15
}

/**
 * The characters of `text` the reader's fonts cannot draw in `stack`, as far as the shards reach.
 * @param {string} text
 * @param {string} stack
 */
export function uncovered(text, stack) {
  const out = []
  for (const char of text ?? '') {
    // Whitespace and controls draw no ink, which would read as the missing-glyph box.
    if (/[\s\u0000-\u001F]/u.test(char)) continue
    const name = ((char.codePointAt(0) ?? 0) >> 8).toString(16).padStart(3, '0')
    if (!SHARDS.has(name)) continue
    const key = `${stack}\u0000${char}`
    let drawn = COVERED.get(key)
    if (drawn === undefined) {
      drawn = covered(char, stack)
      COVERED.set(key, drawn)
    }
    if (!drawn) out.push(char)
  }
  return out
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
  if (!root || typeof MutationObserver !== 'function') return () => {}
  /** @type {WeakSet<Element>} */
  const watched = new WeakSet()
  // What a panel renders is what it shows: the shards of those characters come with the render, so a
  // part never waits for a scroll to stop drawing a box. A panel that re-renders loads only the
  // characters it gained, since a shard is fetched once.
  const scan = () => {
    for (const element of root.querySelectorAll('*')) {
      if (element.childElementCount || watched.has(element)) continue
      watched.add(element)
      // The reader's own fonts draw most of this; only what they leave as a box needs a shard.
      loadFallbackText(element.textContent, getComputedStyle(element).fontFamily)
    }
  }
  const mutation = new MutationObserver(() => {
    if (PENDING.has(root)) return
    PENDING.set(root, setTimeout(() => { PENDING.delete(root); if (root.isConnected) scan() }, 50))
  })
  scan()
  mutation.observe(root, { childList: true, subtree: true, characterData: true })
  return () => {
    mutation.disconnect()
    const pending = PENDING.get(root)
    if (pending) { clearTimeout(pending); PENDING.delete(root) }
  }
}
