// The bundled fallback outlines, one webfont face per 256-code-point shard. A text-style sheet
// downloads every face whose range its text meets at once, so a panel of rare characters would pull
// megabytes on first paint. Each shard is a `FontFace` registered and loaded the first time one of
// its characters is shown, so the reader pays for the shards their screens need. The dev server
// names the files itself; `demo/vite.config.js` writes `unicode.json` with the published names.

const FAMILY = 'IDS Fallback'
// No element uses the oblique style, so the browser does not pull the faces for plain text.
const STYLE = 'oblique 0deg'
/** The shards, by the first byte of their range, read from the sheet that declares them. */
/** @type {Set<string>} */
const SHARDS = new Set()
/** @type {Record<string, string>} */
let published = {}
// While developing, the sheet names the shards; the build writes `unicode.json` with their names.
const ready = fetch(new URL('unicode.json', new URL('./', document.baseURI)))
  .then(response => response.ok ? response.json() : { files: {} })
  .then(data => {
    published = data.files ?? {}
    for (const name of Object.keys(published)) SHARDS.add(name)
    if (!SHARDS.size) for (let shard = 0; shard < 0x400; shard++) SHARDS.add(shard.toString(16).padStart(3, '0'))
  })
  .catch(() => { for (let shard = 0; shard < 0x400; shard++) SHARDS.add(shard.toString(16).padStart(3, '0')) })

/** @type {Map<string, Promise<FontFace>>} */
const faces = new Map()

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
      const url = new URL(published[name] ?? `fonts/unicode/${name}.woff2`, new URL('./', document.baseURI)).href
      const made = new FontFace(FAMILY, `url("${url}")`, { style: STYLE })
      document.fonts.add(made)
      return made.load()
    }).catch(() => new FontFace(FAMILY, ''))
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
